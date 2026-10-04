import type {
  CantonDisclosedContract,
} from "./ledger-client.js";

export type CantonChoiceContextData =
  Readonly<Record<string, unknown>>;

export interface CantonRegistryChoiceContext {
  choiceContextData:
    CantonChoiceContextData;

  disclosedContracts:
    readonly CantonDisclosedContract[];
}

export interface CantonAllocationFactory {
  factoryId: string;
  choiceContext:
    CantonRegistryChoiceContext;
}

export interface CantonTokenRegistryClient {
  getAllocationFactory(
    choiceArguments:
      Record<string, unknown>,
  ): Promise<CantonAllocationFactory>;

  getAllocationExecuteTransferContext(
    allocationId: string,
    meta?: Readonly<
      Record<string, string>
    >,
  ): Promise<CantonRegistryChoiceContext>;
}

export interface HttpCantonTokenRegistryOptions {
  baseUrl: string;

  fetcher?:
    typeof globalThis.fetch;

  getAccessToken?:
    () => Promise<
      string | undefined
    >;
}

export class HttpCantonTokenRegistryClient
  implements CantonTokenRegistryClient
{
  readonly #baseUrl: string;
  readonly #fetcher:
    typeof globalThis.fetch;

  constructor(
    private readonly options:
      HttpCantonTokenRegistryOptions,
  ) {
    this.#baseUrl =
      options.baseUrl.replace(
        /\/+$/,
        "",
      );

    this.#fetcher =
      options.fetcher ??
      globalThis.fetch.bind(
        globalThis,
      );
  }

  async getAllocationFactory(
    choiceArguments:
      Record<string, unknown>,
  ): Promise<CantonAllocationFactory> {
    const response =
      await this.requestJson(
        "/registry/allocation-instruction/v1/allocation-factory",
        {
          method: "POST",

          body: JSON.stringify({
            choiceArguments,
            excludeDebugFields:
              true,
          }),
        },
      );

    return {
      factoryId:
        requireString(
          response,
          "factoryId",
        ),

      choiceContext:
        parseChoiceContext(
          response.choiceContext,
        ),
    };
  }

  async getAllocationExecuteTransferContext(
    allocationId: string,
    meta:
      Readonly<
        Record<string, string>
      > = {},
  ): Promise<CantonRegistryChoiceContext> {
    const response =
      await this.requestJson(
        `/registry/allocations/v1/${encodeURIComponent(
          allocationId,
        )}/choice-contexts/execute-transfer`,
        {
          method: "POST",

          body: JSON.stringify({
            meta,
            excludeDebugFields:
              true,
          }),
        },
      );

    return parseChoiceContext(
      response,
    );
  }

  private async requestJson(
    path: string,
    init: RequestInit,
  ): Promise<Record<string, unknown>> {
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
        `Canton Token Registry ${response.status}: ${
          text ||
          response.statusText
        }`,
      );
    }

    const value =
      text
        ? JSON.parse(text)
        : undefined;

    if (!isRecord(value)) {
      throw new Error(
        "Invalid Canton Token Registry response",
      );
    }

    return value;
  }
}

function parseChoiceContext(
  value: unknown,
): CantonRegistryChoiceContext {
  if (!isRecord(value)) {
    throw new Error(
      "Invalid Canton registry choice context",
    );
  }

  const choiceContextData =
    value.choiceContextData;

  if (!isRecord(choiceContextData)) {
    throw new Error(
      "Canton registry choiceContextData is missing",
    );
  }

  const disclosed =
    value.disclosedContracts;

  if (!Array.isArray(disclosed)) {
    throw new Error(
      "Canton registry disclosedContracts is missing",
    );
  }

  return {
    choiceContextData,

    disclosedContracts:
      disclosed.map(
        parseDisclosedContract,
      ),
  };
}

function parseDisclosedContract(
  value: unknown,
): CantonDisclosedContract {
  if (!isRecord(value)) {
    throw new Error(
      "Invalid Canton disclosed contract",
    );
  }

  return {
    templateId:
      requireString(
        value,
        "templateId",
      ),

    contractId:
      requireString(
        value,
        "contractId",
      ),

    createdEventBlob:
      requireString(
        value,
        "createdEventBlob",
      ),

    synchronizerId:
      requireString(
        value,
        "synchronizerId",
      ),
  };
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
      `Invalid Canton registry field: ${key}`,
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
