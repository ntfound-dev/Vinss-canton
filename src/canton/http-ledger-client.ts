import type {
  CantonPartyId,
} from "./types.js";

import type {
  CantonActiveContractSnapshot,
  CantonAuthenticatedIdentity,
  CantonCreatedContract,
  CantonExercise,
  CantonInterfaceContract,
  CantonLedgerClient,
  CantonSubmissionResult,
  CantonSubmitCreates,
} from "./ledger-client.js";

export interface HttpCantonLedgerOptions {
  baseUrl: string;
  userId: string;

  fetcher?:
    typeof globalThis.fetch;

  getAccessToken?:
    () => Promise<
      string | undefined
    >;
}

export class HttpCantonLedgerClient
  implements CantonLedgerClient
{
  readonly #baseUrl: string;
  readonly #userId: string;
  readonly #fetcher:
    typeof globalThis.fetch;

  constructor(
    private readonly options:
      HttpCantonLedgerOptions,
  ) {
    this.#baseUrl =
      options.baseUrl.replace(
        /\/+$/,
        "",
      );

    this.#userId =
      options.userId;

    this.#fetcher =
      options.fetcher ??
      globalThis.fetch.bind(
        globalThis,
      );
  }

  async getAuthenticatedIdentity():
    Promise<CantonAuthenticatedIdentity> {
    const userResponse =
      await this.requestJson<{
        user?: unknown;
      }>(
        "/v2/authenticated-user",
        {
          method: "GET",
        },
      );

    if (
      !isRecord(
        userResponse.user,
      )
    ) {
      throw new Error(
        "Canton authenticated user is missing",
      );
    }

    const user =
      userResponse.user;

    const id =
      requireString(
        user,
        "id",
      );

    const primaryParty =
      requireString(
        user,
        "primaryParty",
      );

    if (
      user.isDeactivated ===
      true
    ) {
      throw new Error(
        "Canton user is deactivated",
      );
    }

    const rightsResponse =
      await this.requestJson<{
        rights?: unknown;
      }>(
        `/v2/users/${encodeURIComponent(
          id,
        )}/rights`,
        {
          method: "GET",
        },
      );

    const rights =
      Array.isArray(
        rightsResponse.rights,
      )
        ? rightsResponse.rights
        : [];

    const canActAs:
      CantonPartyId[] = [];

    const canReadAs:
      CantonPartyId[] = [];

    for (const right of rights) {
      if (!isRecord(right)) {
        continue;
      }

      const kind =
        right.kind;

      if (!isRecord(kind)) {
        continue;
      }

      collectPartyRight(
        kind.CanActAs,
        canActAs,
      );

      collectPartyRight(
        kind.CanReadAs,
        canReadAs,
      );
    }

    return {
      userId: id,
      primaryParty,
      canActAs,
      canReadAs,
    };
  }

  async submitCreates(
    input: CantonSubmitCreates,
  ): Promise<CantonSubmissionResult> {
    const response =
      await this.requestJson<{
        updateId: string;
        completionOffset:
          number | string;
      }>(
        "/v2/commands/submit-and-wait",
        {
          method: "POST",

          body: JSON.stringify({
            userId:
              this.#userId,

            commandId:
              input.commandId,

            actAs: [
              input.actingParty,
            ],

            readAs: [
              input.actingParty,
            ],

            commands:
              input.creates.map(
                (create) => ({
                  CreateCommand: {
                    templateId:
                      create.templateId,

                    createArguments:
                      create
                        .createArguments,
                  },
                }),
              ),
          }),
        },
      );

    return {
      updateId:
        response.updateId,

      completionOffset:
        toBigIntOffset(
          response
            .completionOffset,
        ),
    };
  }

  async submitExercise(
    input: CantonExercise,
  ): Promise<CantonSubmissionResult> {
    const response =
      await this.requestJson<{
        updateId: string;
        completionOffset:
          number | string;
      }>(
        "/v2/commands/submit-and-wait",
        {
          method: "POST",

          body: JSON.stringify({
            userId:
              this.#userId,

            commandId:
              input.commandId,

            actAs: [
              input.actingParty,
            ],

            readAs: [
              input.actingParty,
            ],

            commands: [
              {
                ExerciseCommand: {
                  templateId:
                    input.templateId,

                  contractId:
                    input.contractId,

                  choice:
                    input.choice,

                  choiceArgument:
                    input.choiceArgument,
                },
              },
            ],

            ...disclosureFields(
              input
                .disclosedContracts,
            ),
          }),
        },
      );

    return {
      updateId:
        response.updateId,

      completionOffset:
        toBigIntOffset(
          response
            .completionOffset,
        ),
    };
  }

  async queryInterfaceContracts(
    party: CantonPartyId,
    interfaceId: string,
  ): Promise<
    readonly CantonInterfaceContract[]
  > {
    const activeAtOffset =
      await this.getLedgerEnd();

    if (
      activeAtOffset === 0n
    ) {
      return [];
    }

    const responses =
      await this.requestJson<
        readonly unknown[]
      >(
        "/v2/state/active-contracts",
        {
          method: "POST",

          body: JSON.stringify({
            activeAtOffset:
              toSafeNumber(
                activeAtOffset,
              ),

            eventFormat: {
              filtersByParty: {
                [party]: {
                  cumulative: [
                    {
                      identifierFilter: {
                        InterfaceFilter: {
                          value: {
                            interfaceId,
                            includeInterfaceView:
                              true,
                            includeCreatedEventBlob:
                              true,
                          },
                        },
                      },
                    },
                  ],
                },
              },

              verbose: false,
            },
          }),
        },
      );

    const contracts:
      CantonInterfaceContract[] =
      [];

    for (
      const response
      of responses
    ) {
      const contract =
        extractInterfaceContract(
          response,
          interfaceId,
        );

      if (contract) {
        contracts.push(
          contract,
        );
      }
    }

    return contracts;
  }

  async queryActiveContracts(
    party: CantonPartyId,
  ): Promise<
    readonly CantonCreatedContract[]
  > {
    const snapshot =
      await this
        .queryActiveContractsSnapshot(
          party,
        );

    return snapshot.contracts;
  }

  async queryActiveContractsSnapshot(
    party: CantonPartyId,
  ): Promise<
    CantonActiveContractSnapshot
  > {
    const activeAtOffset =
      await this.getLedgerEnd();

    if (
      activeAtOffset === 0n
    ) {
      return {
        offset: 0n,
        contracts: [],
      };
    }

    const responses =
      await this.requestJson<
        readonly unknown[]
      >(
        "/v2/state/active-contracts",
        {
          method: "POST",

          body: JSON.stringify({
            activeAtOffset:
              toSafeNumber(
                activeAtOffset,
              ),

            eventFormat: {
              filtersByParty: {
                [party]:
                  wildcardFilters(),
              },

              verbose: false,
            },
          }),
        },
      );

    const contracts:
      CantonCreatedContract[] =
      [];

    for (
      const response
      of responses
    ) {
      const created =
        extractActiveContract(
          response,
        );

      if (created) {
        contracts.push(
          created,
        );
      }
    }

    return {
      offset:
        activeAtOffset,

      contracts,
    };
  }

  async queryCreatedContractsSince(
    party: CantonPartyId,
    afterExclusive: bigint,
  ): Promise<
    readonly CantonCreatedContract[]
  > {
    const ledgerEnd =
      await this.getLedgerEnd();

    if (
      ledgerEnd <=
      afterExclusive
    ) {
      return [];
    }

    let responses: readonly unknown[];

    try {
      responses = await this.requestJson<
        readonly unknown[]
      >(
        "/v2/updates",
        {
          method: "POST",

          body: JSON.stringify({
            beginExclusive:
              toSafeNumber(
                afterExclusive,
              ),

            endInclusive:
              toSafeNumber(
                ledgerEnd,
              ),

            updateFormat: {
              includeTransactions: {
                transactionShape:
                  "TRANSACTION_SHAPE_ACS_DELTA",

                eventFormat: {
                  filtersByParty: {
                    [party]:
                      wildcardFilters(),
                  },

                  verbose: false,
                },
              },
            },
          }),
        },
      );
    } catch (error) {
      if (!(error instanceof Error) ||
          !/\bPARTICIPANT_PRUNED_DATA_ACCESSED\b/.test(error.message)) {
        throw error;
      }

      // A fresh messaging cursor starts at zero, which can precede retention
      // on a shared participant. Recover retained deliveries/messages from a
      // current, party-filtered ACS instead of repeatedly reading pruned history.
      // Preserve original event offsets: MLS must process welcome/commit/message
      // in ledger order. Archived history cannot be recovered by this fallback.
      const snapshot = await this.queryActiveContractsSnapshot(party);
      return snapshot.contracts
        .filter((contract) => contract.offset > afterExclusive)
        .sort((a, b) => a.offset < b.offset ? -1 : a.offset > b.offset ? 1 : 0);
    }

    const result:
      CantonCreatedContract[] =
      [];

    for (
      const response
      of responses
    ) {
      result.push(
        ...extractCreatedContractsFromUpdate(
          response,
        ),
      );
    }

    result.sort(
      (left, right) =>
        left.offset <
        right.offset
          ? -1
          : left.offset >
              right.offset
            ? 1
            : 0,
    );

    return result;
  }

  private async getLedgerEnd():
    Promise<bigint> {
    const result =
      await this.requestJson<{
        offset?:
          number | string;
      }>(
        "/v2/state/ledger-end",
        {
          method: "GET",
        },
      );

    if (
      result.offset ===
      undefined
    ) {
      return 0n;
    }

    return toBigIntOffset(
      result.offset,
    );
  }

  private async requestJson<T>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const token =
      await this.options
        .getAccessToken?.();

    const response =
      await this.#fetcher(
        `${this.#baseUrl}${path}`,
        {
          ...init,

          headers: {
            accept:
              "application/json",

            ...(init.body
              ? {
                  "content-type":
                    "application/json",
                }
              : {}),

            ...(token
              ? {
                  authorization:
                    `Bearer ${token}`,
                }
              : {}),

            ...init.headers,
          },
        },
      );

    const text =
      await response.text();

    if (!response.ok) {
      throw new Error(
        `Canton JSON Ledger API ${response.status}: ${
          text ||
          response.statusText
        }`,
      );
    }

    if (!text) {
      return undefined as T;
    }

    return JSON.parse(
      text,
    ) as T;
  }
}

function wildcardFilters():
  Record<string, unknown> {
  return {
    cumulative: [
      {
        identifierFilter: {
          WildcardFilter: {
            value: {
              includeCreatedEventBlob:
                false,
            },
          },
        },
      },
    ],
  };
}

function disclosureFields(
  contracts:
    readonly import("./ledger-client.js").CantonDisclosedContract[]
    | undefined,
): Record<string, unknown> {
  if (
    !contracts ||
    contracts.length === 0
  ) {
    return {};
  }

  const synchronizerId =
    contracts[0]
      ?.synchronizerId;

  if (!synchronizerId) {
    throw new Error(
      "Canton disclosed contract is missing synchronizerId",
    );
  }

  if (
    contracts.some(
      (contract) =>
        contract.synchronizerId !==
        synchronizerId,
    )
  ) {
    throw new Error(
      "Canton disclosed contracts span multiple synchronizers",
    );
  }

  return {
    disclosedContracts:
      contracts,

    synchronizerId,
  };
}

function extractInterfaceContract(
  value: unknown,
  interfaceId: string,
):
  | CantonInterfaceContract
  | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entry =
    value.contractEntry;

  if (!isRecord(entry)) {
    return undefined;
  }

  const active =
    unwrapVariant(
      entry.JsActiveContract,
    );

  if (!active) {
    return undefined;
  }

  const raw =
    unwrapVariant(
      active.createdEvent,
    );

  if (
    !raw ||
    typeof raw.contractId !==
      "string" ||
    typeof raw.templateId !==
      "string" ||
    !isRecord(
      raw.createArgument,
    ) ||
    !Array.isArray(
      raw.interfaceViews,
    )
  ) {
    return undefined;
  }

  const interfaceView =
    raw.interfaceViews.find(
      (candidate) =>
        isRecord(candidate) &&
        candidate.interfaceId ===
          interfaceId &&
        isRecord(
          candidate.viewValue,
        ),
    );

  if (
    !isRecord(
      interfaceView,
    ) ||
    !isRecord(
      interfaceView.viewValue,
    )
  ) {
    return undefined;
  }

  const result:
    CantonInterfaceContract = {
      contractId:
        raw.contractId,

      templateId:
        raw.templateId,

      offset:
        toBigIntOffset(
          raw.offset,
        ),

      createArgument:
        raw.createArgument,

      interfaceId,

      interfaceView:
        interfaceView.viewValue,
    };

  if (
    typeof raw.packageName ===
      "string"
  ) {
    result.packageName =
      raw.packageName;
  }

  return result;
}

function extractActiveContract(
  value: unknown,
):
  | CantonCreatedContract
  | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entry =
    value.contractEntry;

  if (!isRecord(entry)) {
    return undefined;
  }

  const active =
    unwrapVariant(
      entry.JsActiveContract,
    );

  if (!active) {
    return undefined;
  }

  return extractCreatedEvent(
    active.createdEvent,
  );
}

function extractCreatedContractsFromUpdate(
  value: unknown,
): CantonCreatedContract[] {
  if (!isRecord(value)) {
    return [];
  }

  const update =
    value.update;

  if (!isRecord(update)) {
    return [];
  }

  const transaction =
    unwrapVariant(
      update.Transaction,
    );

  if (
    !transaction ||
    !Array.isArray(
      transaction.events,
    )
  ) {
    return [];
  }

  const result:
    CantonCreatedContract[] =
      [];

  for (
    const event
    of transaction.events
  ) {
    if (!isRecord(event)) {
      continue;
    }

    const created =
      extractCreatedEvent(
        event.CreatedEvent,
      );

    if (created) {
      result.push(created);
    }
  }

  return result;
}

function extractCreatedEvent(
  value: unknown,
):
  | CantonCreatedContract
  | undefined {
  const event =
    unwrapVariant(value);

  if (!event) {
    return undefined;
  }

  if (
    typeof event.contractId !==
      "string" ||
    typeof event.templateId !==
      "string" ||
    !isRecord(
      event.createArgument,
    )
  ) {
    return undefined;
  }

  const result:
    CantonCreatedContract = {
      contractId:
        event.contractId,

      templateId:
        event.templateId,

      offset:
        toBigIntOffset(
          event.offset,
        ),

      createArgument:
        event.createArgument,
    };

  if (
    typeof event.packageName ===
      "string"
  ) {
    result.packageName =
      event.packageName;
  }

  return result;
}

function collectPartyRight(
  value: unknown,
  output: CantonPartyId[],
): void {
  const right =
    unwrapVariant(value);

  if (!right) {
    return;
  }

  if (
    typeof right.party ===
    "string"
  ) {
    output.push(
      right.party,
    );
  }
}

function unwrapVariant(
  value: unknown,
):
  | Record<string, unknown>
  | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (
    isRecord(value.value)
  ) {
    return value.value;
  }

  return value;
}

function requireString(
  value:
    Record<string, unknown>,
  key: string,
): string {
  const result =
    value[key];

  if (
    typeof result !==
      "string" ||
    result.length === 0
  ) {
    throw new Error(
      `Invalid Canton field: ${key}`,
    );
  }

  return result;
}

function toBigIntOffset(
  value: unknown,
): bigint {
  if (
    typeof value === "number"
  ) {
    if (
      !Number.isSafeInteger(
        value,
      ) ||
      value < 0
    ) {
      throw new Error(
        "Invalid Canton offset",
      );
    }

    return BigInt(value);
  }

  if (
    typeof value === "string" &&
    /^\d+$/.test(value)
  ) {
    return BigInt(value);
  }

  throw new Error(
    "Invalid Canton offset",
  );
}

function toSafeNumber(
  value: bigint,
): number {
  const result =
    Number(value);

  if (
    !Number.isSafeInteger(
      result,
    ) ||
    result < 0
  ) {
    throw new Error(
      "Canton offset exceeds JavaScript safe integer range",
    );
  }

  return result;
}

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
