import type {
  CantonPartyId,
} from "./types.js";

import type {
  CantonCreatedContract,
  CantonLedgerClient,
  CantonSubmissionResult,
  CantonSubmitCreates,
} from "./ledger-client.js";

export interface HttpCantonLedgerOptions {
  baseUrl: string;
  userId: string;
  fetcher?: typeof globalThis.fetch;
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

  async submitCreates(
    input: CantonSubmitCreates,
  ): Promise<CantonSubmissionResult> {
    const response =
      await this.requestJson<{
        updateId: string;
        completionOffset: number;
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

  async queryActiveContracts(
    party: CantonPartyId,
  ): Promise<
    readonly CantonCreatedContract[]
  > {
    const activeAtOffset =
      await this.getLedgerEnd();

    if (activeAtOffset === 0) {
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
            activeAtOffset,
            eventFormat: {
              filtersByParty: {
                [party]: {
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
                },
              },
              verbose: false,
            },
          }),
        },
      );

    const contracts:
      CantonCreatedContract[] = [];

    for (
      const response
      of responses
    ) {
      const created =
        extractCreatedEvent(
          response,
        );

      if (created) {
        contracts.push(created);
      }
    }

    return contracts;
  }

  private async getLedgerEnd():
    Promise<number> {
    const result =
      await this.requestJson<{
        offset?: number;
      }>(
        "/v2/state/ledger-end",
        {
          method: "GET",
        },
      );

    const offset =
      result.offset ?? 0;

    if (
      !Number.isSafeInteger(
        offset,
      ) ||
      offset < 0
    ) {
      throw new Error(
        "Invalid Canton ledger end offset",
      );
    }

    return offset;
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

    return JSON.parse(text) as T;
  }
}

function extractCreatedEvent(
  value: unknown,
): CantonCreatedContract | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entry =
    value.contractEntry;

  if (
    !isRecord(entry) ||
    !isRecord(
      entry.JsActiveContract,
    )
  ) {
    return undefined;
  }

  const event =
    entry.JsActiveContract
      .createdEvent;

  if (!isRecord(event)) {
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

  const offset =
    toBigIntOffset(
      event.offset,
    );

  const result:
    CantonCreatedContract = {
      contractId:
        event.contractId,
      templateId:
        event.templateId,
      offset,
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

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
