import type {
  CantonCreatedContract,
  CantonLedgerClient,
} from "../../canton/ledger-client.js";

import type {
  CantonUpdateStream,
  CantonUpdateSubscription,
} from "../../canton/update-stream.js";

import type {
  SecureMessagingProvider,
} from "../provider.js";

import type {
  ConversationId,
  InstallationId,
  PlainMessage,
} from "../types.js";

import type {
  CantonMessagingDirectory,
} from "./directory.js";

import type {
  CantonLiveStateStore,
} from "./live-state-store.js";

import {
  isCantonTemplate,
} from "./templates.js";

interface LiveSessionCallbacks {
  onMessages(
    conversationId:
      ConversationId,
    messages:
      readonly PlainMessage[],
  ):
    | void
    | Promise<void>;

  onLedgerOffset?(
    offset: bigint,
  ):
    | void
    | Promise<void>;

  onError?(
    error: Error,
  ): void;

  onClose?(): void;
}

export class CantonLiveMessagingSession {
  readonly #messageCursors =
    new Map<
      ConversationId,
      string
    >();

  constructor(
    private readonly provider:
      SecureMessagingProvider,

    private readonly updates:
      CantonUpdateStream,

    private readonly ledger:
      CantonLedgerClient,

    private readonly directory:
      CantonMessagingDirectory,

    private readonly installationId:
      InstallationId,

    private readonly stateStore?:
      CantonLiveStateStore,
  ) {}

  async start(
    input: LiveSessionCallbacks,
  ): Promise<
    CantonUpdateSubscription
  > {
    const party =
      this.directory
        .activeParty();

    const persistedOffset =
      await this.stateStore
        ?.loadLedgerOffset(
          party,
          this.installationId,
        );

    let afterExclusive:
      bigint;

    if (
      persistedOffset !==
      undefined
    ) {
      afterExclusive =
        persistedOffset;
    } else {
      // First startup:
      //
      // 1. Capture ACS at exact offset X.
      // 2. Bring MLS/application state up to date
      //    for conversations visible at X.
      // 3. Persist X.
      // 4. Subscribe beginExclusive = X.
      //
      // Anything <= X belongs to the snapshot.
      // Anything > X belongs to the live stream.
      const snapshot =
        await this.ledger
          .queryActiveContractsSnapshot(
            party,
          );

      await this.processContracts(
        snapshot.contracts,
        party,
        input,
      );

      if (
        this.stateStore
      ) {
        await this.stateStore
          .saveLedgerOffset(
            party,
            this.installationId,
            snapshot.offset,
          );
      }

      await input
        .onLedgerOffset?.(
          snapshot.offset,
        );

      afterExclusive =
        snapshot.offset;
    }

    return this.updates
      .subscribe({
        party,

        afterExclusive,

        ...(input.onError
          ? {
              onError:
                input.onError,
            }
          : {}),

        ...(input.onClose
          ? {
              onClose:
                input.onClose,
            }
          : {}),

        onBatch:
          async (
            batch,
          ) => {
            await this.processContracts(
              batch.createdContracts,
              party,
              input,
            );

            if (
              this.stateStore
            ) {
              await this.stateStore
                .saveLedgerOffset(
                  party,
                  this.installationId,
                  batch.offset,
                );
            }

            await input
              .onLedgerOffset?.(
                batch.offset,
              );
          },
      });
  }

  private async processContracts(
    contracts:
      readonly CantonCreatedContract[],

    party: string,

    input:
      LiveSessionCallbacks,
  ): Promise<void> {
    const conversations =
      relevantConversations(
        contracts,
        party,
        this.installationId,
      );

    for (
      const conversationId
      of conversations
    ) {
      let cursor =
        this.#messageCursors
          .get(
            conversationId,
          );

      if (
        cursor ===
          undefined &&
        this.stateStore
      ) {
        cursor =
          await this.stateStore
            .loadMessageCursor(
              this.installationId,
              conversationId,
            );
      }

      const result =
        await this.provider
          .sync(
            conversationId,
            cursor,
          );

      if (
        result.nextCursor
      ) {
        if (
          this.stateStore
        ) {
          await this.stateStore
            .saveMessageCursor(
              this.installationId,
              conversationId,
              result
                .nextCursor,
            );
        }

        this.#messageCursors
          .set(
            conversationId,
            result
              .nextCursor,
          );
      }

      if (
        result.messages
          .length > 0
      ) {
        await input
          .onMessages(
            conversationId,
            result.messages,
          );
      }
    }
  }
}

function relevantConversations(
  contracts:
    readonly CantonCreatedContract[],
  activeParty: string,
  installationId: string,
): readonly ConversationId[] {
  const result =
    new Set<
      ConversationId
    >();

  for (
    const contract
    of contracts
  ) {
    const args =
      contract.createArgument;

    if (
      isCantonTemplate(
        contract.templateId,
        "MlsDelivery",
      )
    ) {
      if (
        readString(
          args,
          "recipient",
        ) !==
          activeParty ||
        readString(
          args,
          "recipientInstallationId",
        ) !==
          installationId
      ) {
        continue;
      }

      result.add(
        readString(
          args,
          "channelId",
        ),
      );

      continue;
    }

    if (
      isCantonTemplate(
        contract.templateId,
        "EncryptedMessage",
      )
    ) {
      const sender =
        readString(
          args,
          "sender",
        );

      const recipients =
        readStringArray(
          args,
          "recipients",
        );

      if (
        sender ===
          activeParty ||
        recipients.includes(
          activeParty,
        )
      ) {
        result.add(
          readString(
            args,
            "channelId",
          ),
        );
      }
    }
  }

  return [
    ...result,
  ];
}

function readString(
  value:
    Record<string, unknown>,
  key: string,
): string {
  const result =
    value[key];

  if (
    typeof result !==
      "string"
  ) {
    throw new Error(
      `Invalid Canton messaging field: ${key}`,
    );
  }

  return result;
}

function readStringArray(
  value:
    Record<string, unknown>,
  key: string,
): readonly string[] {
  const result =
    value[key];

  if (
    !Array.isArray(result) ||
    !result.every(
      (item) =>
        typeof item ===
        "string",
    )
  ) {
    throw new Error(
      `Invalid Canton messaging field: ${key}`,
    );
  }

  return result;
}
