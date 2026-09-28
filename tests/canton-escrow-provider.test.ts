import {
  describe,
  expect,
  it,
} from "vitest";

import {
  cantonDealTemplates,
} from "../src/canton/deal-templates.js";

import {
  HttpCantonOfferProvider,
} from "../src/canton/http-offer-provider.js";

import type {
  CantonActiveContractSnapshot,
  CantonAuthenticatedIdentity,
  CantonCreatedContract,
  CantonExercise,
  CantonLedgerClient,
  CantonSubmissionResult,
  CantonSubmitCreates,
} from "../src/canton/ledger-client.js";

import type {
  DealTerms,
} from "../src/canton/types.js";

type Args =
  Record<string, unknown>;

const NOW =
  "2026-09-28T00:00:00.000Z";

const stakeholderKeys:
  Readonly<
    Record<
      string,
      readonly string[]
    >
  > = {
    DealProposal:
      ["seller", "buyer"],

    DealAgreement:
      ["seller", "buyer"],

    DealEscrow:
      ["seller", "buyer"],

    DealFulfillment:
      ["fulfiller", "reviewer"],

    DealRevisionRequest:
      ["reviewer", "fulfiller"],

    FulfillmentApproval:
      ["reviewer", "fulfiller"],

    SettlementReceipt:
      ["fulfiller", "reviewer"],

    CashHolding:
      ["custodian", "owner"],

    LockedHolding:
      [
        "custodian",
        "payer",
        "payee",
      ],
  };

const dealKeys = [
  "dealId",
  "conversationId",
  "seller",
  "buyer",
  "fulfiller",
  "reviewer",
  "termsHash",
  "amount",
  "instrumentId",
] as const;

function nameOf(
  templateId: string,
): string {
  return templateId.slice(
    templateId.lastIndexOf(":") +
      1,
  );
}

function pick(
  source: Args,
  keys: readonly string[],
): Args {
  return Object.fromEntries(
    keys.map(
      (key) => [
        key,
        source[key],
      ],
    ),
  );
}

/**
 * Minimal in-memory ledger that mirrors the state transitions of
 * daml/Vinss/Deal.daml and daml/Vinss/Custody.daml. It only exists to
 * exercise the provider; the real Daml semantics are covered by
 * tests/integration/canton-real-smoke.mjs against a Canton sandbox.
 */
class FakeLedger
  implements CantonLedgerClient
{
  readonly contracts:
    CantonCreatedContract[] = [];

  readonly exercises:
    CantonExercise[] = [];

  private counter = 0n;

  async submitCreates(
    input:
      CantonSubmitCreates,
  ): Promise<CantonSubmissionResult> {
    for (
      const create
      of input.creates
    ) {
      this.insert(
        create.templateId,
        create.createArguments,
      );
    }

    return this.result();
  }

  async submitExercise(
    input:
      CantonExercise,
  ): Promise<CantonSubmissionResult> {
    this.exercises.push(input);

    const contract =
      this.find(
        input.contractId,
      );

    const args =
      contract.createArgument;

    const key =
      `${nameOf(contract.templateId)}.${input.choice}`;

    const carried = [
      ...dealKeys,
      "expiresAt",
      "acceptedAt",
    ];

    switch (key) {
      case "DealProposal.Accept":
        this.consume(contract);

        this.insert(
          cantonDealTemplates
            .agreement,
          {
            ...pick(
              args,
              [
                ...dealKeys,
                "expiresAt",
                "custodian",
              ],
            ),

            acceptedAt: NOW,
          },
        );
        break;

      case "DealAgreement.SubmitFulfillment":
        if (
          typeof args
            .custodian ===
          "string"
        ) {
          throw new Error(
            "Fund the escrow before submitting fulfillment",
          );
        }

        this.consume(contract);

        this.insert(
          cantonDealTemplates
            .fulfillment,
          {
            ...pick(
              args,
              carried,
            ),

            fulfillmentHash:
              input
                .choiceArgument
                .fulfillmentHash,

            round: 0,
            submittedAt: NOW,
            lockedHoldingCid:
              null,
          },
        );
        break;

      case "DealAgreement.FundEscrow": {
        if (
          input.actingParty !==
          args.reviewer
        ) {
          throw new Error(
            "DAML_AUTHORIZATION_ERROR",
          );
        }

        const holding =
          this.find(
            String(
              input
                .choiceArgument
                .holdingCid,
            ),
          );

        const held =
          holding.createArgument;

        if (
          held.custodian !==
            args.custodian ||
          held.owner !==
            args.reviewer ||
          held.amount !==
            args.amount ||
          held.instrumentId !==
            args.instrumentId
        ) {
          throw new Error(
            "Holding does not match the deal",
          );
        }

        this.consume(contract);
        this.consume(holding);

        const locked =
          this.insert(
            cantonDealTemplates
              .lockedHolding,
            {
              holdingId:
                held.holdingId,

              custodian:
                held.custodian,

              payer:
                held.owner,

              payee:
                args.fulfiller,

              amount:
                held.amount,

              instrumentId:
                held
                  .instrumentId,

              dealId:
                args.dealId,
            },
          );

        this.insert(
          cantonDealTemplates
            .escrow,
          {
            ...pick(
              args,
              carried,
            ),

            custodian:
              args.custodian,

            lockedHoldingCid:
              locked.contractId,

            fundedAt: NOW,
          },
        );
        break;
      }

      case "DealEscrow.SubmitFundedFulfillment":
        this.consume(contract);

        this.insert(
          cantonDealTemplates
            .fulfillment,
          {
            ...pick(
              args,
              carried,
            ),

            fulfillmentHash:
              input
                .choiceArgument
                .fulfillmentHash,

            round: 0,
            submittedAt: NOW,
            lockedHoldingCid:
              args
                .lockedHoldingCid,
          },
        );
        break;

      case "DealFulfillment.Approve":
        this.consume(contract);

        this.insert(
          cantonDealTemplates
            .fulfillmentApproval,
          {
            ...pick(
              args,
              [
                ...dealKeys,
                "fulfillmentHash",
                "round",
                "submittedAt",
                "lockedHoldingCid",
              ],
            ),

            approvedAt: NOW,
          },
        );
        break;

      case "FulfillmentApproval.Settle": {
        if (
          input.actingParty !==
          args.fulfiller
        ) {
          throw new Error(
            "DAML_AUTHORIZATION_ERROR",
          );
        }

        if (
          typeof args
            .lockedHoldingCid !==
          "string"
        ) {
          throw new Error(
            "This deal has no Canton escrow to settle",
          );
        }

        const locked =
          this.find(
            args.lockedHoldingCid,
          );

        const held =
          locked.createArgument;

        this.consume(contract);
        this.consume(locked);

        const released =
          this.insert(
            cantonDealTemplates
              .cashHolding,
            {
              holdingId:
                `${String(held.holdingId)}:released`,

              custodian:
                held.custodian,

              owner:
                held.payee,

              amount:
                held.amount,

              instrumentId:
                held
                  .instrumentId,
            },
          );

        this.insert(
          cantonDealTemplates
            .settlementReceipt,
          {
            ...pick(
              args,
              [
                ...dealKeys.filter(
                  (name) =>
                    name !==
                      "termsHash",
                ),
                "fulfillmentHash",
                "round",
              ],
            ),

            releasedHoldingCid:
              released.contractId,

            settledAt: NOW,
          },
        );
        break;
      }

      default:
        throw new Error(
          `Unsupported fake choice: ${key}`,
        );
    }

    return this.result();
  }

  async queryActiveContracts(
    party: string,
  ): Promise<
    readonly CantonCreatedContract[]
  > {
    return this.contracts.filter(
      (contract) =>
        (stakeholderKeys[
          nameOf(
            contract.templateId,
          )
        ] ?? []).some(
          (key) =>
            contract
              .createArgument[
                key
              ] === party,
        ),
    );
  }

  async queryActiveContractsSnapshot():
    Promise<
      CantonActiveContractSnapshot
    > {
    throw new Error("not used");
  }

  async queryCreatedContractsSince():
    Promise<
      readonly CantonCreatedContract[]
    > {
    throw new Error("not used");
  }

  async getAuthenticatedIdentity():
    Promise<
      CantonAuthenticatedIdentity
    > {
    throw new Error("not used");
  }

  named(
    templateName: string,
  ): CantonCreatedContract[] {
    return this.contracts.filter(
      (contract) =>
        nameOf(
          contract.templateId,
        ) === templateName,
    );
  }

  lastUpdateId(): string {
    return `update-${this.counter}`;
  }

  private insert(
    templateId: string,
    createArgument: Args,
  ): CantonCreatedContract {
    this.counter += 1n;

    const contract = {
      contractId:
        `cid-${this.counter}`,

      templateId,

      offset:
        this.counter,

      createArgument,
    };

    this.contracts.push(contract);

    return contract;
  }

  private consume(
    contract:
      CantonCreatedContract,
  ): void {
    const index =
      this.contracts.indexOf(
        contract,
      );

    this.contracts.splice(
      index,
      1,
    );
  }

  private find(
    contractId: string,
  ): CantonCreatedContract {
    const contract =
      this.contracts.find(
        (candidate) =>
          candidate.contractId ===
          contractId,
      );

    if (!contract) {
      throw new Error(
        `CONTRACT_NOT_FOUND: ${contractId}`,
      );
    }

    return contract;
  }

  private result():
    CantonSubmissionResult {
    this.counter += 1n;

    return {
      updateId:
        `update-${this.counter}`,

      completionOffset:
        this.counter,
    };
  }
}

const seller =
  "Seller::vinss";

const buyer =
  "Buyer::vinss";

const custodian =
  "Custodian::vinss";

const otherCustodian =
  "OtherCustodian::vinss";

const HASH =
  "a".repeat(64);

function dealTerms(
  overrides:
    Partial<DealTerms> = {},
): DealTerms {
  return {
    dealId: "deal-1",
    conversationId:
      "conversation-1",

    seller,
    buyer,

    termsHash: HASH,
    amount: "100",
    instrumentId: "USD",

    expiresAt:
      new Date(
        Date.now() + 3_600_000,
      ).toISOString(),

    custodian,

    ...overrides,
  };
}

function legacyTerms():
  DealTerms {
  const {
    custodian:
      _custodian,
    ...rest
  } = dealTerms();

  return rest;
}

function setup() {
  const ledger =
    new FakeLedger();

  const provider =
    new HttpCantonOfferProvider(
      ledger,
    );

  return {
    ledger,
    provider,
  };
}

async function agreeOn(
  provider:
    HttpCantonOfferProvider,
  terms: DealTerms,
) {
  const proposal =
    await provider
      .createProposal(
        seller,
        terms,
      );

  return provider
    .acceptProposal(
      buyer,
      proposal,
    );
}

function fundChoices(
  ledger: FakeLedger,
): CantonExercise[] {
  return ledger.exercises.filter(
    (exercise) =>
      exercise.choice ===
      "FundEscrow",
  );
}

describe(
  "Canton escrow provider",
  () => {
    it(
      "locks the payer's holding, delivers against the escrow and settles to the payee",
      async () => {
        const {
          ledger,
          provider,
        } = setup();

        const holdingCid =
          await provider
            .issueHolding(
              custodian,
              {
                holdingId:
                  "deposit-1",

                owner: buyer,
                amount: "100",
                instrumentId:
                  "USD",
              },
            );

        const agreement =
          await agreeOn(
            provider,
            dealTerms(),
          );

        expect(
          agreement.terms
            .custodian,
        ).toBe(custodian);

        const escrowCid =
          await provider
            .fundEscrow(
              buyer,
              agreement
                .contractId,
              holdingCid,
            );

        const fund =
          fundChoices(
            ledger,
          )[0];

        expect(
          fund?.templateId,
        ).toBe(
          cantonDealTemplates
            .agreement,
        );

        expect(
          fund
            ?.choiceArgument,
        ).toEqual({
          holdingCid,
        });

        expect(
          ledger.named(
            "CashHolding",
          ),
        ).toHaveLength(0);

        expect(
          ledger.named(
            "LockedHolding",
          ),
        ).toHaveLength(1);

        const fulfillmentCid =
          await provider
            .submitFulfillment(
              seller,
              escrowCid,
              HASH,
            );

        const submit =
          ledger.exercises.find(
            (exercise) =>
              exercise.choice ===
              "SubmitFundedFulfillment",
          );

        expect(
          submit?.templateId,
        ).toBe(
          cantonDealTemplates
            .escrow,
        );

        const approvalCid =
          await provider
            .approveFulfillment(
              buyer,
              fulfillmentCid,
            );

        const receipt =
          await provider
            .settle(
              seller,
              approvalCid,
            );

        expect(
          receipt.dealId,
        ).toBe("deal-1");

        expect(
          receipt
            .approvalContractId,
        ).toBe(approvalCid);

        expect(
          receipt.updateId,
        ).toBe(
          ledger.lastUpdateId(),
        );

        expect(
          receipt.settledAt,
        ).toBe(NOW);

        const released =
          ledger.named(
            "CashHolding",
          );

        expect(
          released,
        ).toHaveLength(1);

        expect(
          released[0]
            ?.createArgument,
        ).toEqual({
          holdingId:
            "deposit-1:released",

          custodian,
          owner: seller,
          amount: "100",
          instrumentId:
            "USD",
        });

        expect(
          ledger.named(
            "LockedHolding",
          ),
        ).toHaveLength(0);

        expect(
          ledger.named(
            "SettlementReceipt",
          )[0]?.contractId,
        ).toBe(
          receipt
            .receiptContractId,
        );
      },
    );

    it(
      "pays the fulfiller when the roles are swapped",
      async () => {
        const {
          ledger,
          provider,
        } = setup();

        // Freelance-style deal: the buyer does the work and the seller
        // reviews, so the seller (reviewer) funds and the buyer is paid.
        const holdingCid =
          await provider
            .issueHolding(
              custodian,
              {
                holdingId:
                  "deposit-2",

                owner: seller,
                amount: "100",
                instrumentId:
                  "USD",
              },
            );

        const agreement =
          await agreeOn(
            provider,
            dealTerms({
              fulfiller: buyer,
              reviewer: seller,
            }),
          );

        await expect(
          provider.fundEscrow(
            buyer,
            agreement
              .contractId,
            holdingCid,
          ),
        ).rejects.toThrow(
          "Only the VINSS reviewer (payer) can fund the escrow",
        );

        const escrowCid =
          await provider
            .fundEscrow(
              seller,
              agreement
                .contractId,
              holdingCid,
            );

        const fulfillmentCid =
          await provider
            .submitFulfillment(
              buyer,
              escrowCid,
              HASH,
            );

        const approvalCid =
          await provider
            .approveFulfillment(
              seller,
              fulfillmentCid,
            );

        await provider.settle(
          buyer,
          approvalCid,
        );

        expect(
          ledger.named(
            "CashHolding",
          )[0]
            ?.createArgument
            .owner,
        ).toBe(buyer);
      },
    );

    it(
      "keeps the original flow for deals without a custodian",
      async () => {
        const {
          ledger,
          provider,
        } = setup();

        const agreement =
          await agreeOn(
            provider,
            legacyTerms(),
          );

        expect(
          agreement.terms
            .custodian,
        ).toBeUndefined();

        await expect(
          provider.fundEscrow(
            buyer,
            agreement
              .contractId,
            "cid-unused",
          ),
        ).rejects.toThrow(
          "does not use Canton escrow",
        );

        const fulfillmentCid =
          await provider
            .submitFulfillment(
              seller,
              agreement
                .contractId,
              HASH,
            );

        const submit =
          ledger.exercises.find(
            (exercise) =>
              exercise.choice ===
              "SubmitFulfillment",
          );

        expect(
          submit?.templateId,
        ).toBe(
          cantonDealTemplates
            .agreement,
        );

        const approvalCid =
          await provider
            .approveFulfillment(
              buyer,
              fulfillmentCid,
            );

        const before =
          ledger.exercises
            .length;

        await expect(
          provider.settle(
            seller,
            approvalCid,
          ),
        ).rejects.toThrow(
          "has no Canton escrow to settle",
        );

        expect(
          ledger.exercises
            .length,
        ).toBe(before);
      },
    );

    it(
      "refuses to skip funding on a deal that uses escrow",
      async () => {
        const {
          ledger,
          provider,
        } = setup();

        const agreement =
          await agreeOn(
            provider,
            dealTerms(),
          );

        await expect(
          provider
            .submitFulfillment(
              seller,
              agreement
                .contractId,
              HASH,
            ),
        ).rejects.toThrow(
          "fund it before submitting fulfillment",
        );

        expect(
          ledger.exercises
            .some(
              (exercise) =>
                exercise
                  .choice ===
                "SubmitFulfillment",
            ),
        ).toBe(false);
      },
    );

    it(
      "rejects a holding that does not match the deal before submitting anything",
      async () => {
        const {
          ledger,
          provider,
        } = setup();

        const agreement =
          await agreeOn(
            provider,
            dealTerms(),
          );

        const issue = (
          issuer: string,
          holdingId: string,
          amount: string,
          instrumentId: string,
        ) =>
          provider.issueHolding(
            issuer,
            {
              holdingId,
              owner: buyer,
              amount,
              instrumentId,
            },
          );

        const wrongCustodian =
          await issue(
            otherCustodian,
            "d-a",
            "100",
            "USD",
          );

        const wrongAmount =
          await issue(
            custodian,
            "d-b",
            "99",
            "USD",
          );

        const wrongInstrument =
          await issue(
            custodian,
            "d-c",
            "100",
            "EUR",
          );

        const cases: [
          string,
          string,
        ][] = [
          [
            wrongCustodian,
            "not issued by the agreed custodian",
          ],
          [
            wrongAmount,
            "amount must match the deal amount exactly",
          ],
          [
            wrongInstrument,
            "instrument must match the deal instrument",
          ],
        ];

        for (
          const [
            holdingCid,
            message,
          ]
          of cases
        ) {
          await expect(
            provider
              .fundEscrow(
                buyer,
                agreement
                  .contractId,
                holdingCid,
              ),
          ).rejects.toThrow(
            message,
          );
        }

        expect(
          fundChoices(
            ledger,
          ),
        ).toHaveLength(0);
      },
    );

    it(
      "only lets the payer fund and only lets the payee settle",
      async () => {
        const {
          ledger,
          provider,
        } = setup();

        const holdingCid =
          await provider
            .issueHolding(
              custodian,
              {
                holdingId:
                  "deposit-3",

                owner: buyer,
                amount: "100",
                instrumentId:
                  "USD",
              },
            );

        const agreement =
          await agreeOn(
            provider,
            dealTerms(),
          );

        await expect(
          provider.fundEscrow(
            seller,
            agreement
              .contractId,
            holdingCid,
          ),
        ).rejects.toThrow(
          "Only the VINSS reviewer (payer) can fund the escrow",
        );

        expect(
          fundChoices(
            ledger,
          ),
        ).toHaveLength(0);

        const escrowCid =
          await provider
            .fundEscrow(
              buyer,
              agreement
                .contractId,
              holdingCid,
            );

        const approvalCid =
          await provider
            .approveFulfillment(
              buyer,
              await provider
                .submitFulfillment(
                  seller,
                  escrowCid,
                  HASH,
                ),
            );

        await expect(
          provider.settle(
            buyer,
            approvalCid,
          ),
        ).rejects.toThrow(
          "Only the VINSS fulfiller (payee) can settle the escrow",
        );

        expect(
          ledger.named(
            "LockedHolding",
          ),
        ).toHaveLength(1);
      },
    );

    it(
      "validates holdings before issuing them",
      async () => {
        const {
          ledger,
          provider,
        } = setup();

        const holding = (
          overrides:
            Record<
              string,
              string
            > = {},
        ) => ({
          holdingId:
            "deposit-4",

          owner: buyer,
          amount: "100",
          instrumentId: "USD",
          ...overrides,
        });

        for (
          const amount
          of [
            "0",
            "0.00",
            "-5",
            "abc",
            "",
          ]
        ) {
          await expect(
            provider
              .issueHolding(
                custodian,
                holding({
                  amount,
                }),
              ),
          ).rejects.toThrow(
            "greater than zero",
          );
        }

        await expect(
          provider
            .issueHolding(
              custodian,
              holding({
                holdingId: " ",
              }),
            ),
        ).rejects.toThrow(
          "holding id is required",
        );

        await expect(
          provider
            .issueHolding(
              custodian,
              holding({
                owner:
                  custodian,
              }),
            ),
        ).rejects.toThrow(
          "cannot issue a holding to itself",
        );

        expect(
          ledger.contracts,
        ).toHaveLength(0);

        await provider
          .issueHolding(
            custodian,
            holding(),
          );

        await expect(
          provider
            .issueHolding(
              custodian,
              holding(),
            ),
        ).rejects.toThrow(
          "already issued",
        );

        expect(
          ledger.named(
            "CashHolding",
          ),
        ).toHaveLength(1);
      },
    );

    it(
      "requires the custodian to be independent of the deal parties",
      async () => {
        const {
          ledger,
          provider,
        } = setup();

        for (
          const party
          of [seller, buyer]
        ) {
          await expect(
            provider
              .createProposal(
                seller,
                dealTerms({
                  custodian:
                    party,
                }),
              ),
          ).rejects.toThrow(
            "custodian must be independent of the deal parties",
          );
        }

        expect(
          ledger.contracts,
        ).toHaveLength(0);
      },
    );
  },
);
