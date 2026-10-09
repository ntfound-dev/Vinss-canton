import type {
  CantonInterfaceContract,
  CantonLedgerClient,
} from "./ledger-client.js";

import type {
  CantonDealProvider,
} from "./provider.js";

import type {
  CantonRegistryDirectory,
} from "./registry-directory.js";

import {
  HttpCantonTokenRegistryClient,
  type CantonTokenRegistryClient,
} from "./token-registry-client.js";

import type {
  CantonPartyId,
  DealAgreement,
  SettlementReceipt,
} from "./types.js";

const HOLDING_INTERFACE =
  "#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding";

const ALLOCATION_INTERFACE =
  "#splice-api-token-allocation-v1:Splice.Api.Token.AllocationV1:Allocation";

const ALLOCATION_FACTORY_INTERFACE =
  "#splice-api-token-allocation-instruction-v1:Splice.Api.Token.AllocationInstructionV1:AllocationFactory";

const FIVE_MINUTES =
  5 * 60 * 1000;

const ONE_MINUTE =
  60 * 1000;

export interface CantonAllocationFundingResult {
  allocationContractId: string;
  escrowContractId: string;
}

export interface CantonTokenWalletOptions {
  ledger:
    CantonLedgerClient;

  dealProvider:
    CantonDealProvider;

  registryDirectory:
    CantonRegistryDirectory;

  registryClientFactory?:
    (
      registryUrl: string,
    ) => CantonTokenRegistryClient;

  now?:
    () => Date;
}

/**
 * Wallet-side orchestration for VINSS Canton escrow.
 *
 * Token economics stay in the registry. VINSS selects the payer's standard
 * Holdings, asks the registry to create an Allocation, then references that
 * Allocation from the VINSS DealAgreement.
 */
export class CantonTokenWallet {
  readonly #ledger:
    CantonLedgerClient;

  readonly #dealProvider:
    CantonDealProvider;

  readonly #registryDirectory:
    CantonRegistryDirectory;

  readonly #registryClientFactory:
    (
      registryUrl: string,
    ) => CantonTokenRegistryClient;

  readonly #now:
    () => Date;

  constructor(
    options:
      CantonTokenWalletOptions,
  ) {
    this.#ledger =
      options.ledger;

    this.#dealProvider =
      options.dealProvider;

    this.#registryDirectory =
      options.registryDirectory;

    this.#registryClientFactory =
      options.registryClientFactory ??
      (
        (registryUrl) =>
          new HttpCantonTokenRegistryClient({
            baseUrl:
              registryUrl,
          })
      );

    this.#now =
      options.now ??
      (() => new Date());
  }

  async allocateAndFundEscrow(
    actingParty:
      CantonPartyId,

    agreement:
      DealAgreement,
  ): Promise<CantonAllocationFundingResult> {
    const queryInterface =
      this.#ledger
        .queryInterfaceContracts;

    if (!queryInterface) {
      throw new Error(
        "Canton ledger client does not support Token Standard interface queries",
      );
    }

    const terms =
      agreement.terms;

    const payer =
      terms.reviewer ??
      terms.buyer;

    const payee =
      terms.fulfiller ??
      terms.seller;

    if (
      actingParty !==
      payer
    ) {
      throw new Error(
        "Only the VINSS reviewer (payer) can allocate escrow funds",
      );
    }

    const admin =
      terms.instrumentAdmin;

    if (!admin) {
      throw new Error(
        "This VINSS deal has no Canton Token Registry",
      );
    }

    // A previous allocation may have committed before FundEscrow failed.
    // Reuse it rather than locking the payer's holdings a second time.
    const existing = (await queryInterface.call(this.#ledger, actingParty, ALLOCATION_INTERFACE))
      .filter(candidate => allocationMatchesAgreement(candidate, agreement, this.#now())).at(-1);
    if (existing) {
      const escrowContractId = await this.#dealProvider.fundEscrow(actingParty, agreement.contractId, existing.contractId);
      return { allocationContractId: existing.contractId, escrowContractId };
    }

    const now =
      this.#now();

    const settleBeforeMs =
      Date.parse(
        terms.expiresAt,
      );

    if (
      !Number.isFinite(
        settleBeforeMs,
      ) ||
      settleBeforeMs <=
        now.getTime() +
          ONE_MINUTE
    ) {
      throw new Error(
        "VINSS deal expires too soon to create a Canton Allocation",
      );
    }

    const allocateBeforeMs =
      Math.min(
        now.getTime() +
          FIVE_MINUTES,
        settleBeforeMs -
          ONE_MINUTE,
      );

    const holdings =
      await queryInterface.call(
        this.#ledger,
        actingParty,
        HOLDING_INTERFACE,
      );

    const selected =
      selectHoldings(
        holdings,
        actingParty,
        admin,
        terms.instrumentId,
        terms.amount,
      );

    const requestedAt =
      now.toISOString();

    const allocationSpecification = {
      settlement: {
        executor:
          payee,

        settlementRef: {
          id:
            terms.dealId,

          cid:
            null,
        },

        requestedAt,

        allocateBefore:
          new Date(
            allocateBeforeMs,
          ).toISOString(),

        settleBefore:
          new Date(
            settleBeforeMs,
          ).toISOString(),

        meta: {
          values: {},
        },
      },

      transferLegId:
        "vinss-principal",

      transferLeg: {
        sender:
          payer,

        receiver:
          payee,

        amount:
          terms.amount,

        instrumentId: {
          admin,
          id:
            terms.instrumentId,
        },

        meta: {
          values: {},
        },
      },
    };

    const choiceArguments:
      Record<string, unknown> = {
        expectedAdmin:
          admin,

        allocation:
          allocationSpecification,

        requestedAt,

        inputHoldingCids:
          selected.map(
            (holding) =>
              holding
                .contractId,
          ),

        extraArgs: {
          context: {
            values: {},
          },

          meta: {
            values: {},
          },
        },
      };

    const registry =
      this.registryForAdmin(
        admin,
      );

    const factory =
      await registry
        .getAllocationFactory(
          choiceArguments,
        );

    choiceArguments.extraArgs = {
      context:
        factory
          .choiceContext
          .choiceContextData,

      meta: {
        values: {},
      },
    };

    await this.#ledger
      .submitExercise({
        actingParty,

        commandId:
          `vinss-allocation-${crypto.randomUUID()}`,

        templateId:
          ALLOCATION_FACTORY_INTERFACE,

        contractId:
          factory.factoryId,

        choice:
          "AllocationFactory_Allocate",

        choiceArgument:
          choiceArguments,

        disclosedContracts:
          factory
            .choiceContext
            .disclosedContracts,
      });

    const allocations =
      await queryInterface.call(
        this.#ledger,
        actingParty,
        ALLOCATION_INTERFACE,
      );

    const allocation =
      allocations
        .filter(
          (candidate) =>
            allocationDealId(
              candidate,
            ) ===
            terms.dealId,
        )
        .at(-1);

    if (!allocation) {
      throw new Error(
        "Canton Allocation was not found after AllocationFactory_Allocate",
      );
    }

    const escrowContractId =
      await this
        .#dealProvider
        .fundEscrow(
          actingParty,
          agreement.contractId,
          allocation.contractId,
        );

    return {
      allocationContractId:
        allocation.contractId,

      escrowContractId,
    };
  }

  async settleWithRegistry(
    actingParty:
      CantonPartyId,

    approvalContractId:
      string,
  ): Promise<SettlementReceipt> {
    const queryInterface =
      this.#ledger
        .queryInterfaceContracts;

    if (!queryInterface) {
      throw new Error(
        "Canton ledger client does not support Token Standard interface queries",
      );
    }

    const contracts =
      await this.#ledger
        .queryActiveContracts(
          actingParty,
        );

    const approval =
      contracts.find(
        (candidate) =>
          candidate.contractId ===
            approvalContractId &&
          candidate.templateId.endsWith(
            ":Vinss.Deal:FulfillmentApproval",
          ),
      );

    if (!approval) {
      throw new Error(
        `VINSS FulfillmentApproval not found: ${approvalContractId}`,
      );
    }

    const allocationId =
      optionalString(
        approval.createArgument,
        "lockedAllocationCid",
      );

    if (!allocationId) {
      throw new Error(
        "This VINSS approval has no Canton Allocation",
      );
    }

    const allocations =
      await queryInterface.call(
        this.#ledger,
        actingParty,
        ALLOCATION_INTERFACE,
      );

    const allocation =
      allocations.find(
        (candidate) =>
          candidate.contractId ===
          allocationId,
      );

    if (!allocation) {
      throw new Error(
        `Canton Allocation not found: ${allocationId}`,
      );
    }

    const admin =
      allocationAdmin(
        allocation,
      );

    const context =
      await this
        .registryForAdmin(
          admin,
        )
        .getAllocationExecuteTransferContext(
          allocationId,
        );

    return this
      .#dealProvider
      .settle(
        actingParty,
        approvalContractId,
        context,
      );
  }

  private registryForAdmin(
    admin: string,
  ): CantonTokenRegistryClient {
    return this
      .#registryClientFactory(
        this
          .#registryDirectory
          .registryUrlForAdmin(
            admin,
          ),
      );
  }
}

function selectHoldings(
  contracts:
    readonly CantonInterfaceContract[],

  owner: string,
  admin: string,
  instrumentId: string,
  amount: string,
): CantonInterfaceContract[] {
  const wanted =
    decimalUnits(
      amount,
    );

  if (wanted <= 0n) {
    throw new Error(
      "VINSS deal amount must be positive",
    );
  }

  const eligible =
    contracts
      .filter(
        (contract) => {
          const view =
            contract.interfaceView;

          const instrument =
            record(
              view.instrumentId,
            );

          return (
            view.owner ===
              owner &&
            instrument?.admin ===
              admin &&
            instrument?.id ===
              instrumentId &&
            (
              view.lock ===
                null ||
              view.lock ===
                undefined
            ) &&
            typeof view.amount ===
              "string" &&
            decimalUnits(
              view.amount,
            ) >
              0n
          );
        },
      )
      .sort(
        (left, right) => {
          const a =
            decimalUnits(
              String(
                left
                  .interfaceView
                  .amount,
              ),
            );

          const b =
            decimalUnits(
              String(
                right
                  .interfaceView
                  .amount,
              ),
            );

          return a < b
            ? -1
            : a > b
              ? 1
              : 0;
        },
      );

  const selected:
    CantonInterfaceContract[] =
      [];

  let total =
    0n;

  for (
    const holding
    of eligible
  ) {
    selected.push(
      holding,
    );

    total +=
      decimalUnits(
        String(
          holding
            .interfaceView
            .amount,
        ),
      );

    if (total >= wanted) {
      return selected;
    }
  }

  throw new Error(
    "Insufficient Canton Token Standard holdings for VINSS escrow",
  );
}

function allocationDealId(
  contract:
    CantonInterfaceContract,
): string | undefined {
  const allocation =
    record(
      contract
        .interfaceView
        .allocation,
    );

  const settlement =
    record(
      allocation
        ?.settlement,
    );

  const reference =
    record(
      settlement
        ?.settlementRef,
    );

  return typeof reference?.id ===
    "string"
    ? reference.id
    : undefined;
}

function allocationAdmin(
  contract:
    CantonInterfaceContract,
): string {
  const allocation =
    record(
      contract
        .interfaceView
        .allocation,
    );

  const leg =
    record(
      allocation
        ?.transferLeg,
    );

  const instrument =
    record(
      leg
        ?.instrumentId,
    );

  if (
    typeof instrument?.admin !==
      "string"
  ) {
    throw new Error(
      "Canton Allocation is missing instrument admin",
    );
  }

  return instrument.admin;
}

function decimalUnits(
  value: string,
): bigint {
  const match =
    /^(\d+)(?:\.(\d{1,10}))?$/.exec(
      value.trim(),
    );

  if (!match) {
    throw new Error(
      `Invalid Canton Decimal: ${value}`,
    );
  }

  const whole =
    match[1];

  if (whole === undefined) {
    throw new Error(
      `Invalid Canton Decimal: ${value}`,
    );
  }

  const fraction =
    (
      match[2] ??
      ""
    ).padEnd(
      10,
      "0",
    );

  return (
    BigInt(
      whole,
    ) *
      10_000_000_000n +
    BigInt(
      fraction ||
      "0",
    )
  );
}

function optionalString(
  value:
    Record<string, unknown>,
  key: string,
): string | undefined {
  const result =
    value[key];

  return typeof result ===
    "string"
    ? result
    : undefined;
}

function record(
  value: unknown,
):
  | Record<string, unknown>
  | undefined {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(value)
  )
    ? value as
        Record<string, unknown>
    : undefined;
}

function allocationMatchesAgreement(contract: CantonInterfaceContract, agreement: DealAgreement, now: Date): boolean {
  const allocation = record(contract.interfaceView.allocation);
  const leg = record(allocation?.transferLeg);
  const settlement = record(allocation?.settlement);
  const instrument = record(leg?.instrumentId);
  const terms = agreement.terms;
  return allocationDealId(contract) === terms.dealId &&
    leg?.sender === (terms.reviewer ?? terms.buyer) && leg?.receiver === (terms.fulfiller ?? terms.seller) &&
    settlement?.executor === (terms.fulfiller ?? terms.seller) &&
    instrument?.admin === terms.instrumentAdmin && instrument?.id === terms.instrumentId &&
    typeof leg?.amount === "string" && decimalUnits(leg.amount) === decimalUnits(terms.amount) &&
    typeof settlement?.settleBefore === "string" && Date.parse(settlement.settleBefore) > now.getTime();
}
