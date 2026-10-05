import * as cantonSdk
  from "@canton-network/dapp-sdk";

import {
  HttpCantonLedgerClient,
} from "../../src/canton/http-ledger-client.js";

import type {
  CantonActiveContractSnapshot,
  CantonAuthenticatedIdentity,
  CantonCreatedContract,
  CantonExercise,
  CantonInterfaceContract,
  CantonLedgerClient,
  CantonSubmissionResult,
  CantonSubmitCreates,
} from "../../src/canton/ledger-client.js";

import type {
  CantonPartyId,
} from "../../src/canton/types.js";

type WalletAccount =
  Awaited<
    ReturnType<
      typeof cantonSdk.listAccounts
    >
  >[number];

export class CantonDappLedgerClient
  implements CantonLedgerClient
{
  readonly #delegate:
    HttpCantonLedgerClient;

  private constructor() {
    this.#delegate =
      new HttpCantonLedgerClient({
        baseUrl:
          "https://vinss-canton-wallet.invalid",

        userId:
          "vinss-dapp-wallet",

        fetcher:
          walletGatewayFetch,
      });
  }

  static async connect(
    expectedParty?:
      string,
  ): Promise<
    CantonDappLedgerClient
  > {
    await cantonSdk.init();

    const connection =
      await cantonSdk
        .isConnected();

    if (!connection.isConnected) {
      throw new Error(
        "Connect your Canton wallet before opening the VINSS room",
      );
    }

    const accounts =
      await cantonSdk
        .listAccounts();

    const primary =
      selectPrimaryAccount(
        accounts,
      );

    if (!primary) {
      throw new Error(
        "No usable Canton Party is available in the connected wallet",
      );
    }

    if (
      expectedParty &&
      primary.partyId !==
        expectedParty
    ) {
      throw new Error(
        "The active Canton wallet Party changed; reconnect the room",
      );
    }

    return new CantonDappLedgerClient();
  }

  async getAuthenticatedIdentity():
    Promise<CantonAuthenticatedIdentity> {
    const accounts =
      await cantonSdk
        .listAccounts();

    const primary =
      selectPrimaryAccount(
        accounts,
      );

    if (!primary) {
      throw new Error(
        "No active Canton Party is available",
      );
    }

    const usable =
      accounts.filter(
        isUsableAccount,
      );

    const parties =
      usable.map(
        (account) =>
          account.partyId,
      );

    return {
      // The dApp session is wallet-scoped. VINSS only needs a
      // stable identifier for its local OpenMLS installation key.
      userId:
        `wallet:${primary.partyId}`,

      primaryParty:
        primary.partyId,

      canActAs:
        parties.includes(
          primary.partyId,
        )
          ? parties
          : [
              primary.partyId,
              ...parties,
            ],

      canReadAs:
        parties.includes(
          primary.partyId,
        )
          ? parties
          : [
              primary.partyId,
              ...parties,
            ],
    };
  }

  submitCreates(
    input:
      CantonSubmitCreates,
  ): Promise<CantonSubmissionResult> {
    return this.#delegate
      .submitCreates(
        input,
      );
  }

  submitExercise(
    input:
      CantonExercise,
  ): Promise<CantonSubmissionResult> {
    return this.#delegate
      .submitExercise(
        input,
      );
  }

  queryActiveContracts(
    party:
      CantonPartyId,
  ): Promise<
    readonly CantonCreatedContract[]
  > {
    return this.#delegate
      .queryActiveContracts(
        party,
      );
  }

  queryInterfaceContracts(
    party:
      CantonPartyId,

    interfaceId:
      string,
  ): Promise<
    readonly CantonInterfaceContract[]
  > {
    return this.#delegate
      .queryInterfaceContracts(
        party,
        interfaceId,
      );
  }

  queryActiveContractsSnapshot(
    party:
      CantonPartyId,
  ): Promise<
    CantonActiveContractSnapshot
  > {
    return this.#delegate
      .queryActiveContractsSnapshot(
        party,
      );
  }

  queryCreatedContractsSince(
    party:
      CantonPartyId,

    afterExclusive:
      bigint,
  ): Promise<
    readonly CantonCreatedContract[]
  > {
    return this.#delegate
      .queryCreatedContractsSince(
        party,
        afterExclusive,
      );
  }
}

function selectPrimaryAccount(
  accounts:
    readonly WalletAccount[],
):
  | WalletAccount
  | undefined {
  return (
    accounts.find(
      (account) =>
        account.primary &&
        isUsableAccount(
          account,
        ),
    ) ??
    accounts.find(
      isUsableAccount,
    )
  );
}

function isUsableAccount(
  account:
    WalletAccount,
): boolean {
  return (
    account.status !==
      "removed" &&
    account.disabled !==
      true
  );
}

const walletGatewayFetch:
  typeof globalThis.fetch =
async (
  input,
  init,
): Promise<Response> => {
  const url =
    requestUrl(input);

  const parsed =
    new URL(url);

  const resource =
    parsed.pathname;

  const method =
    (
      init?.method ??
      "GET"
    )
      .toLowerCase();

  if (
    resource ===
      "/v2/commands/submit-and-wait" &&
    method === "post"
  ) {
    return executeWithWallet(
      parseRequestBody(
        init?.body,
      ),
    );
  }

  if (
    method !== "get" &&
    method !== "post"
  ) {
    throw new Error(
      `Unsupported VINSS dApp Ledger method: ${method}`,
    );
  }

  const parsedBody =
    parseRequestBody(
      init?.body,
    );

  let body:
    Record<string, unknown> |
    undefined;

  if (
    parsedBody ===
      undefined
  ) {
    body =
      undefined;
  } else if (
    isRecord(
      parsedBody,
    )
  ) {
    body =
      parsedBody;
  } else {
    throw new Error(
      "VINSS dApp Ledger request body must be a JSON object",
    );
  }

  const result =
    await cantonSdk
      .ledgerApi({
        requestMethod:
          method,

        resource,

        ...(body ===
          undefined
          ? {}
          : {
              body,
            }),
      });

  return jsonResponse(
    unwrapLedgerApiResult(
      result,
    ),
  );
};

async function executeWithWallet(
  value:
    unknown,
): Promise<Response> {
  if (!isRecord(value)) {
    throw new Error(
      "Invalid Canton command submission",
    );
  }

  if (
    !Array.isArray(
      value.commands,
    ) ||
    value.commands.length ===
      0
  ) {
    throw new Error(
      "Canton command submission has no commands",
    );
  }

  const params = {
    commands:
      value.commands,

    ...(typeof value
      .commandId === "string"
      ? {
          commandId:
            value.commandId,
        }
      : {}),

    ...(isStringArray(
      value.actAs,
    )
      ? {
          actAs:
            value.actAs,
        }
      : {}),

    ...(isStringArray(
      value.readAs,
    )
      ? {
          readAs:
            value.readAs,
        }
      : {}),

    ...(Array.isArray(
      value.disclosedContracts,
    )
      ? {
          disclosedContracts:
            value
              .disclosedContracts,
        }
      : {}),

    ...(typeof value
      .synchronizerId ===
      "string"
      ? {
          synchronizerId:
            value
              .synchronizerId,
        }
      : {}),

    ...(isStringArray(
      value
        .packageIdSelectionPreference,
    )
      ? {
          packageIdSelectionPreference:
            value
              .packageIdSelectionPreference,
        }
      : {}),
  } as Parameters<
    typeof cantonSdk
      .prepareExecuteAndWait
  >[0];

  const executed =
    await cantonSdk
      .prepareExecuteAndWait(
        params,
      );

  return jsonResponse({
    updateId:
      executed.tx
        .payload
        .updateId,

    completionOffset:
      executed.tx
        .payload
        .completionOffset,
  });
}

function unwrapLedgerApiResult(
  value:
    unknown,
): unknown {
  // Older docs describe { response: "<json>" }, while current
  // Wallet Gateway returns the parsed Ledger API body directly.
  // Support both so VINSS works with 1.7.x gateways and newer docs.
  if (
    isRecord(value) &&
    typeof value.response ===
      "string"
  ) {
    try {
      return JSON.parse(
        value.response,
      );
    } catch {
      return value.response;
    }
  }

  return value;
}

function jsonResponse(
  value:
    unknown,
): Response {
  if (
    value === undefined
  ) {
    return new Response(
      null,
      {
        status: 200,
      },
    );
  }

  return new Response(
    JSON.stringify(
      value,
    ),
    {
      status: 200,

      headers: {
        "content-type":
          "application/json",
      },
    },
  );
}

function parseRequestBody(
  body:
    BodyInit |
    null |
    undefined,
): unknown {
  if (
    body === undefined ||
    body === null
  ) {
    return undefined;
  }

  if (
    typeof body !==
      "string"
  ) {
    throw new Error(
      "VINSS dApp Ledger adapter only supports JSON request bodies",
    );
  }

  if (!body) {
    return undefined;
  }

  return JSON.parse(
    body,
  );
}

function requestUrl(
  input:
    RequestInfo |
    URL,
): string {
  if (
    typeof input ===
      "string"
  ) {
    return input;
  }

  if (
    input instanceof URL
  ) {
    return input
      .toString();
  }

  return input.url;
}

function isStringArray(
  value:
    unknown,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item ===
          "string",
    )
  );
}

function isRecord(
  value:
    unknown,
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
