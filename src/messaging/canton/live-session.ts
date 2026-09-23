import type {
  CantonCreatedContract,
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

import {
  isCantonTemplate,
} from "./templates.js";

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

    private readonly directory:
      CantonMessagingDirectory,

    private readonly installationId:
      InstallationId,
  ) {}

  async start(input: {
    afterExclusive:
      bigint;

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
  }): Promise<
    CantonUpdateSubscription
  > {
    const party =
      this.directory
        .activeParty();

    return this.updates
      .subscribe({
        party,

        afterExclusive:
          input.afterExclusive,

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
            const conversations =
              relevantConversations(
                batch
                  .createdContracts,
                party,
                this.installationId,
              );

            for (
              const conversationId
              of conversations
            ) {
              const cursor =
                this.#messageCursors
                  .get(
                    conversationId,
                  );

              const result =
                await this.provider
                  .sync(
                    conversationId,
                    cursor,
                  );

              if (
                result.nextCursor
              ) {
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
                    result
                      .messages,
                  );
              }
            }

            await input
              .onLedgerOffset?.(
                batch.offset,
              );
          },
      });
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
