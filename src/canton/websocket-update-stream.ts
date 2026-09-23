import type {
  CantonCreatedContract,
} from "./ledger-client.js";

import type {
  CantonUpdateBatch,
  CantonUpdateStream,
  CantonUpdateSubscription,
} from "./update-stream.js";

interface WebSocketMessage {
  data: unknown;
}

interface CantonWebSocket {
  onopen:
    | (() => void)
    | null;

  onmessage:
    | ((
        event:
          WebSocketMessage,
      ) => void)
    | null;

  onerror:
    | ((event: unknown) => void)
    | null;

  onclose:
    | (() => void)
    | null;

  send(
    data: string,
  ): void;

  close(): void;
}

export type CantonWebSocketFactory =
  (
    url: string,
    protocols:
      readonly string[],
  ) => CantonWebSocket;

export interface CantonWebSocketStreamOptions {
  baseUrl: string;

  getAccessToken?:
    () => Promise<
      string | undefined
    >;

  createWebSocket?:
    CantonWebSocketFactory;
}

export class CantonWebSocketUpdateStream
  implements CantonUpdateStream
{
  readonly #baseUrl: string;

  readonly #factory:
    CantonWebSocketFactory;

  constructor(
    private readonly options:
      CantonWebSocketStreamOptions,
  ) {
    this.#baseUrl =
      toWebSocketBaseUrl(
        options.baseUrl,
      );

    this.#factory =
      options.createWebSocket ??
      (
        (
          url,
          protocols,
        ) =>
          new WebSocket(
            url,
            [...protocols],
          ) as unknown as
            CantonWebSocket
      );
  }

  async subscribe(input: {
    party: string;
    afterExclusive:
      bigint;

    onBatch(
      batch:
        CantonUpdateBatch,
    ):
      | void
      | Promise<void>;

    onError?(
      error: Error,
    ): void;

    onClose?(): void;
  }): Promise<
    CantonUpdateSubscription
  > {
    const token =
      await this.options
        .getAccessToken?.();

    const protocols = [
      "daml.ws.auth",
      ...(token
        ? [
            `jwt.token.${token}`,
          ]
        : []),
    ];

    const socket =
      this.#factory(
        `${this.#baseUrl}/v2/updates`,
        protocols,
      );

    let processing =
      Promise.resolve();

    return new Promise(
      (
        resolve,
        reject,
      ) => {
        let opened = false;

        socket.onopen = () => {
          try {
            socket.send(
              JSON.stringify(
                buildUpdateRequest(
                  input.party,
                  input
                    .afterExclusive,
                ),
              ),
            );

            opened = true;

            resolve({
              close() {
                socket.close();
              },
            });
          } catch (error) {
            reject(
              asError(error),
            );
          }
        };

        socket.onmessage = (
          event,
        ) => {
          processing =
            processing
              .then(
                async () => {
                  const text =
                    await eventDataToText(
                      event.data,
                    );

                  const batch =
                    parseUpdateFrame(
                      text,
                    );

                  if (batch) {
                    await input
                      .onBatch(
                        batch,
                      );
                  }
                },
              )
              .catch(
                (error) => {
                  input.onError?.(
                    asError(
                      error,
                    ),
                  );
                },
              );
        };

        socket.onerror = (
          event,
        ) => {
          const error =
            new Error(
              "Canton WebSocket connection error",
              {
                cause: event,
              },
            );

          if (!opened) {
            reject(error);
            return;
          }

          input.onError?.(
            error,
          );
        };

        socket.onclose = () => {
          input.onClose?.();
        };
      },
    );
  }
}

function buildUpdateRequest(
  party: string,
  afterExclusive: bigint,
): Record<
  string,
  unknown
> {
  return {
    beginExclusive:
      toSafeNumber(
        afterExclusive,
      ),

    updateFormat: {
      includeTransactions: {
        transactionShape:
          "TRANSACTION_SHAPE_ACS_DELTA",

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
      },
    },
  };
}

function parseUpdateFrame(
  text: string,
):
  | CantonUpdateBatch
  | undefined {
  const value: unknown =
    JSON.parse(text);

  if (!isRecord(value)) {
    throw new Error(
      "Invalid Canton update frame",
    );
  }

  if (
    typeof value.code ===
      "string" &&
    typeof value.cause ===
      "string"
  ) {
    throw new Error(
      `Canton stream error ${value.code}: ${value.cause}`,
    );
  }

  if (
    !isRecord(
      value.update,
    )
  ) {
    return undefined;
  }

  const update =
    value.update;

  const transaction =
    unwrapVariant(
      update.Transaction,
    );

  if (transaction) {
    const offset =
      toBigIntOffset(
        transaction.offset,
      );

    const contracts:
      CantonCreatedContract[] =
      [];

    if (
      Array.isArray(
        transaction.events,
      )
    ) {
      for (
        const event
        of transaction.events
      ) {
        const created =
          extractCreatedEvent(
            event,
          );

        if (created) {
          contracts.push(
            created,
          );
        }
      }
    }

    return {
      offset,
      createdContracts:
        contracts,
    };
  }

  const checkpoint =
    unwrapVariant(
      update.OffsetCheckpoint,
    );

  if (checkpoint) {
    return {
      offset:
        toBigIntOffset(
          checkpoint.offset,
        ),

      createdContracts: [],
    };
  }

  return undefined;
}

function extractCreatedEvent(
  value: unknown,
):
  | CantonCreatedContract
  | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const created =
    unwrapVariant(
      value.CreatedEvent,
    );

  if (!created) {
    return undefined;
  }

  if (
    typeof created
      .contractId !==
      "string" ||
    typeof created
      .templateId !==
      "string" ||
    !isRecord(
      created
        .createArgument,
    )
  ) {
    return undefined;
  }

  const result:
    CantonCreatedContract = {
      contractId:
        created.contractId,

      templateId:
        created.templateId,

      offset:
        toBigIntOffset(
          created.offset,
        ),

      createArgument:
        created
          .createArgument,
    };

  if (
    typeof created
      .packageName ===
      "string"
  ) {
    result.packageName =
      created.packageName;
  }

  return result;
}

function unwrapVariant(
  value: unknown,
):
  | Record<
      string,
      unknown
    >
  | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (
    isRecord(
      value.value,
    )
  ) {
    return value.value;
  }

  return value;
}

async function eventDataToText(
  value: unknown,
): Promise<string> {
  if (
    typeof value ===
      "string"
  ) {
    return value;
  }

  if (
    typeof Blob !==
      "undefined" &&
    value instanceof Blob
  ) {
    return value.text();
  }

  if (
    value instanceof
      ArrayBuffer
  ) {
    return new TextDecoder()
      .decode(value);
  }

  if (
    ArrayBuffer.isView(
      value,
    )
  ) {
    return new TextDecoder()
      .decode(value);
  }

  throw new Error(
    "Unsupported Canton WebSocket frame",
  );
}

function toWebSocketBaseUrl(
  baseUrl: string,
): string {
  const url =
    new URL(baseUrl);

  if (
    url.protocol ===
    "https:"
  ) {
    url.protocol = "wss:";
  } else if (
    url.protocol ===
    "http:"
  ) {
    url.protocol = "ws:";
  } else if (
    url.protocol !== "ws:" &&
    url.protocol !== "wss:"
  ) {
    throw new Error(
      `Unsupported Canton URL protocol: ${url.protocol}`,
    );
  }

  return url
    .toString()
    .replace(
      /\/$/,
      "",
    );
}

function toBigIntOffset(
  value: unknown,
): bigint {
  if (
    typeof value ===
      "number"
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
    typeof value ===
      "string" &&
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
      "Canton offset exceeds JavaScript safe range",
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

function asError(
  value: unknown,
): Error {
  return value instanceof Error
    ? value
    : new Error(
        String(value),
      );
}
