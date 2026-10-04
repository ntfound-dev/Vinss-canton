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
  "2026-09-30T00:00:00.000Z";

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

const ALLOCATION_TEMPLATE_ID =
  "#splice-api-token-allocation-v1:Splice.Api.Token.AllocationV1:Allocation";

/**
 * A fake CIP-56 Allocation, as it would be read off the Ledger API: a
 * flat createArgument shaped like `AllocationView.allocation`
 * (AllocationSpecification). Registries construct these off-ledger; VINSS
 * never does, so the test builds one directly the way a payer's wallet
 * would after AllocationFactory_Allocate.
 */
function fakeAllocation(
  contractId: string,
  overrides: {
    dealId: string;
    sender: string;
    receiver: string;
    executor: string;
    admin: string;
  },
): CantonCreatedContract {
  return {
    contractId,
    templateId: ALLOCATION_TEMPLATE_ID,
    offset: 0n,

    createArgument: {
      allocation: {
        settlement: {
          executor:
            overrides.executor,

          settlementRef: {
            id: overrides.dealId,
          },
        },

        transferLeg: {
          sender:
            overrides.sender,

          receiver:
            overrides.receiver,

          amount: "100",

          instrumentId: {
            admin:
              overrides.admin,

            id: "Amulet",
          },
        },
      },

      holdingCids: [],
    },
  };
}

/**
 * Minimal in-memory ledger that mirrors the state transitions of
 * daml/Vinss/Deal.daml. Allocation_ExecuteTransfer is faked at the level
 * the interface promises (sender/receiver/executor authorization, a
 * receiver holding out); the real Allocation semantics belong to whichever
 * registry (Amulet, ...) implements them, exercised against a real Canton
 * sandbox -- see docs/CANTON_COIN_SETUP.md.
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
                "instrumentAdmin",
              ],
            ),

            acceptedAt: NOW,
          },
        );
        break;

      case "DealAgreement.SubmitFulfillment":
        if (
          typeof args
            .instrumentAdmin ===
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
            lockedAllocationCid:
              null,
          },
        );
        break;

      case "DealAgreement.FundEscrow": {
        if (
          typeof args
            .instrumentAdmin !==
          "string"
        ) {
          throw new Error(
            "This deal does not use Canton escrow",
          );
        }

        if (
          input.actingParty !==
          args.reviewer
        ) {
          throw new Error(
            "DAML_AUTHORIZATION_ERROR",
          );
        }

        const allocation =
          this.find(
            String(
              input
                .choiceArgument
                .allocationCid,
            ),
          );

        const spec =
          (
            allocation
              .createArgument as {
              allocation: {
                settlement: {
                  executor: string;
                  settlementRef: {
                    id: string;
                  };
                };
                transferLeg: {
                  sender: string;
                  receiver: string;
                  instrumentId: {
                    admin: string;
                  };
                };
              };
            }
          ).allocation;

        const leg =
          spec.transferLeg;

        // Mirrors the assertMsg checks in DealAgreement.FundEscrow.
        if (
          leg.instrumentId
            .admin !==
          args.instrumentAdmin
        ) {
          throw new Error(
            "Allocation instrument admin must match the agreed registry",
          );
        }

        if (
          spec.settlement
            .settlementRef.id !==
          args.dealId
        ) {
          throw new Error(
            "Allocation must be for this deal",
          );
        }

        if (
          leg.sender !==
          args.reviewer
        ) {
          throw new Error(
            "Allocation sender must be the payer (reviewer)",
          );
        }

        if (
          leg.receiver !==
          args.fulfiller
        ) {
          throw new Error(
            "Allocation receiver must be the payee (fulfiller)",
          );
        }

        if (
          spec.settlement
            .executor !==
          args.fulfiller
        ) {
          throw new Error(
            "Allocation executor must be the payee (fulfiller)",
          );
        }

        this.consume(contract);

        this.insert(
          cantonDealTemplates
            .escrow,
          {
            ...pick(
              args,
              carried,
            ),

            instrumentAdmin:
              args
                .instrumentAdmin,

            lockedAllocationCid:
              allocation.contractId,

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
            lockedAllocationCid:
              args
                .lockedAllocationCid,
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
                "lockedAllocationCid",
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
            .lockedAllocationCid !==
          "string"
        ) {
          throw new Error(
            "This deal has no Canton escrow to settle",
          );
        }

        // Faked Allocation_ExecuteTransfer: archives the Allocation, hands
        // the receiver a holding. Real semantics belong to the registry.
        this.consume(
          this.find(
            args.lockedAllocationCid,
          ),
        );

        const receiverHolding =
          this.insert(
            "#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding",
            {
              owner:
                args.fulfiller,

              amount: "100",
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

            receiverHoldingCids:
              [
                receiverHolding.contractId,
              ],

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
    // The tests only ever look up a contract by id (requireContract /
    // requireContractOf / findLatestContract*), so it is enough for every
    // party to see every VINSS contract here -- real per-party visibility
    // is a Ledger API / Daml stakeholder concern, not this provider's.
    return this.contracts;
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

const registry =
  "Amulet::registry";

const otherRegistry =
  "Other::registry";

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
    instrumentId: "Amulet",

    expiresAt:
      new Date(
        Date.now() + 3_600_000,
      ).toISOString(),

    instrumentAdmin: registry,

    ...overrides,
  };
}

function legacyTerms():
  DealTerms {
  const {
    instrumentAdmin:
      _instrumentAdmin,
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
  "Canton escrow provider (Token Standard Allocation)",
  () => {
    it(
      "funds from the payer's own Allocation, delivers against the escrow and settles to the payee",
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

        expect(
          agreement.terms
            .instrumentAdmin,
        ).toBe(registry);

        const allocation =
          fakeAllocation(
            "alloc-1",
            {
              dealId: "deal-1",
              sender: buyer,
              receiver: seller,
              executor: seller,
              admin: registry,
            },
          );

        ledger.contracts.push(
          allocation,
        );

        const escrowCid =
          await provider
            .fundEscrow(
              buyer,
              agreement
                .contractId,
              allocation.contractId,
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
          allocationCid:
            allocation.contractId,
        });

        // FundEscrow references the Allocation; it never creates a VINSS
        // holding of its own.
        expect(
          ledger.named(
            "Holding",
          ),
        ).toHaveLength(0);

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
              { note: "test" },
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

        const settle =
          ledger.exercises.find(
            (exercise) =>
              exercise.choice ===
              "Settle",
          );

        expect(
          (
            settle
              ?.choiceArgument as {
              extraArgs: {
                context: {
                  values: unknown;
                };
              };
            }
          ).extraArgs.context
            .values,
        ).toEqual({
          note: "test",
        });

        // The Allocation is gone; the payee has a holding instead.
        expect(
          ledger.contracts.some(
            (contract) =>
              contract
                .contractId ===
              "alloc-1",
          ),
        ).toBe(false);

        const holdings =
          ledger.named(
            "Holding",
          );

        expect(
          holdings,
        ).toHaveLength(1);

        expect(
          holdings[0]
            ?.createArgument
            .owner,
        ).toBe(seller);

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
      "keeps the original flow for deals without an instrumentAdmin",
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
            .instrumentAdmin,
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

        await expect(
          provider.settle(
            seller,
            approvalCid,
            {},
          ),
        ).rejects.toThrow(
          "has no Canton escrow to settle",
        );
      },
    );

    it(
      "refuses to skip funding on a deal that uses escrow",
      async () => {
        const {
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
      },
    );

    it(
      "rejects an Allocation that does not match the deal",
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

        const cases: [
          string,
          Parameters<
            typeof fakeAllocation
          >[1],
          string,
        ][] = [
          [
            "wrong-registry",
            {
              dealId: "deal-1",
              sender: buyer,
              receiver: seller,
              executor: seller,
              admin:
                otherRegistry,
            },
            "instrument admin must match the agreed registry",
          ],
          [
            "wrong-deal",
            {
              dealId:
                "some-other-deal",
              sender: buyer,
              receiver: seller,
              executor: seller,
              admin: registry,
            },
            "Allocation must be for this deal",
          ],
          [
            "wrong-sender",
            {
              dealId: "deal-1",
              sender: seller,
              receiver: seller,
              executor: seller,
              admin: registry,
            },
            "sender must be the payer",
          ],
          [
            "wrong-receiver",
            {
              dealId: "deal-1",
              sender: buyer,
              receiver: buyer,
              executor: seller,
              admin: registry,
            },
            "receiver must be the payee",
          ],
          [
            "wrong-executor",
            {
              dealId: "deal-1",
              sender: buyer,
              receiver: seller,
              executor: buyer,
              admin: registry,
            },
            "executor must be the payee",
          ],
        ];

        for (
          const [
            contractId,
            fields,
            message,
          ]
          of cases
        ) {
          ledger.contracts.push(
            fakeAllocation(
              contractId,
              fields,
            ),
          );

          await expect(
            provider
              .fundEscrow(
                buyer,
                agreement
                  .contractId,
                contractId,
              ),
          ).rejects.toThrow(
            message,
          );
        }

        // fundEscrow does not pre-validate the Allocation client-side (the
        // Daml choice does, see FundEscrow's assertMsg checks) -- so all 5
        // rejected attempts still reach the ledger.
        expect(
          fundChoices(ledger),
        ).toHaveLength(5);
      },
    );

    it(
      "only lets the payer fund and only lets the payee settle",
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

        const allocation =
          fakeAllocation(
            "alloc-2",
            {
              dealId: "deal-1",
              sender: buyer,
              receiver: seller,
              executor: seller,
              admin: registry,
            },
          );

        ledger.contracts.push(
          allocation,
        );

        await expect(
          provider.fundEscrow(
            seller,
            agreement
              .contractId,
            allocation.contractId,
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
              allocation.contractId,
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
            {},
          ),
        ).rejects.toThrow(
          "Only the VINSS fulfiller (payee) can settle the escrow",
        );

        expect(
          ledger.contracts.some(
            (contract) =>
              contract
                .contractId ===
              "alloc-2",
          ),
        ).toBe(true);
      },
    );

    it(
      "requires the instrumentAdmin to be independent of the deal parties",
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
                  instrumentAdmin:
                    party,
                }),
              ),
          ).rejects.toThrow(
            "instrumentAdmin must be independent of the deal parties",
          );
        }

        expect(
          ledger.contracts,
        ).toHaveLength(0);
      },
    );
  },
);
