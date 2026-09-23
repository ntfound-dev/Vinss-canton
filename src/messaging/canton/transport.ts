import type {
  CantonCreatedContract,
  CantonLedgerClient,
} from "../../canton/ledger-client.js";

import type {
  CantonPartyId,
} from "../../canton/types.js";

import type {
  MessagingTransport,
  KeyPackageEnvelope,
  MlsHandshakeDelivery,
  MlsHandshakeEnvelope,
} from "../transport.js";

import type {
  CiphertextEnvelope,
  ConversationId,
  InstallationId,
} from "../types.js";

import {
  base64ToBytes,
  bytesToBase64,
} from "./codec.js";

import type {
  CantonMessagingDirectory,
} from "./directory.js";

import {
  cantonMessagingTemplates,
  isCantonTemplate,
} from "./templates.js";

export class CantonMessagingTransport
  implements MessagingTransport
{
  constructor(
    private readonly ledger:
      CantonLedgerClient,
    private readonly directory:
      CantonMessagingDirectory,
  ) {}

  async publishKeyPackage(
    envelope: KeyPackageEnvelope,
  ): Promise<void> {
    const owner =
      this.directory
        .activeParty();

    const readers =
      uniqueParties(
        await this.directory
          .keyPackageReaders(),
      ).filter(
        (party) =>
          party !== owner,
      );

    if (readers.length === 0) {
      return;
    }

    await this.ledger.submitCreates({
      actingParty: owner,
      commandId:
        commandId(
          "key-package",
        ),
      creates:
        readers.map(
          (requester) => ({
            templateId:
              cantonMessagingTemplates
                .keyPackage,

            createArguments: {
              packageId:
                crypto.randomUUID(),
              requestId:
                `advertisement:${crypto.randomUUID()}`,
              owner,
              requester,
              installationId:
                envelope.installationId,
              keyPackageB64:
                bytesToBase64(
                  envelope.keyPackage,
                ),
              createdAt:
                toDamlTime(
                  envelope.createdAt,
                ),
              expiresAt:
                toDamlTime(
                  envelope.expiresAt,
                ),
            },
          }),
        ),
    });
  }

  async fetchKeyPackages(
    installationIds:
      readonly InstallationId[],
  ): Promise<
    readonly KeyPackageEnvelope[]
  > {
    if (
      installationIds.length ===
      0
    ) {
      return [];
    }

    const party =
      this.directory
        .activeParty();

    const wanted =
      new Set(
        installationIds,
      );

    const contracts =
      await this.ledger
        .queryActiveContracts(
          party,
        );

    const newest =
      new Map<
        InstallationId,
        KeyPackageEnvelope
      >();

    for (
      const contract
      of contracts
    ) {
      if (
        !isCantonTemplate(
          contract.templateId,
          "KeyPackageOffer",
        )
      ) {
        continue;
      }

      const args =
        contract.createArgument;

      if (
        readString(
          args,
          "requester",
        ) !== party
      ) {
        continue;
      }

      const installationId =
        readString(
          args,
          "installationId",
        );

      if (
        !wanted.has(
          installationId,
        )
      ) {
        continue;
      }

      const expiresAt =
        readTimeMs(
          args,
          "expiresAt",
        );

      if (
        expiresAt <= Date.now()
      ) {
        continue;
      }

      const candidate:
        KeyPackageEnvelope = {
          installationId,
          createdAt:
            readTimeMs(
              args,
              "createdAt",
            ),
          expiresAt,
          keyPackage:
            base64ToBytes(
              readString(
                args,
                "keyPackageB64",
              ),
            ),
        };

      const current =
        newest.get(
          installationId,
        );

      if (
        !current ||
        candidate.expiresAt >
          current.expiresAt
      ) {
        newest.set(
          installationId,
          candidate,
        );
      }
    }

    return [
      ...newest.values(),
    ];
  }

  async publishHandshakes(
    deliveries:
      readonly MlsHandshakeDelivery[],
  ): Promise<void> {
    if (
      deliveries.length === 0
    ) {
      return;
    }

    const activeParty =
      this.directory
        .activeParty();

    const creates =
      await Promise.all(
        deliveries.map(
          async (
            delivery,
          ) => {
            const sender =
              await this.directory
                .partyForInstallation(
                  delivery
                    .senderInstallationId,
                );

            if (
              sender !==
              activeParty
            ) {
              throw new Error(
                "MLS sender installation does not belong to active Canton party",
              );
            }

            const recipient =
              await this.directory
                .partyForInstallation(
                  delivery
                    .recipientInstallationId,
                );

            return {
              templateId:
                cantonMessagingTemplates
                  .delivery,

              createArguments: {
                deliveryId:
                  crypto.randomUUID(),
                channelId:
                  delivery
                    .conversationId,
                sender,
                recipient,
                senderInstallationId:
                  delivery
                    .senderInstallationId,
                recipientInstallationId:
                  delivery
                    .recipientInstallationId,
                kind:
                  delivery.kind,
                payloadB64:
                  bytesToBase64(
                    delivery.payload,
                  ),
                createdAt:
                  toDamlTime(
                    delivery.sentAt,
                  ),
              },
            };
          },
        ),
      );

    // One Canton composite command:
    // all Commit/Welcome creations succeed or fail together.
    await this.ledger.submitCreates({
      actingParty:
        activeParty,
      commandId:
        commandId(
          "mls-handshake",
        ),
      creates,
    });
  }

  async fetchHandshakes(
    installationId:
      InstallationId,
    cursor?: string,
  ): Promise<{
    items:
      readonly MlsHandshakeEnvelope[];
    nextCursor?: string;
  }> {
    const activeParty =
      this.directory
        .activeParty();

    const after =
      parseCursor(
        cursor,
        "h",
      );

    const contracts =
      await this.ledger
        .queryActiveContracts(
          activeParty,
        );

    const items:
      MlsHandshakeEnvelope[] =
      [];

    for (
      const contract
      of contracts
    ) {
      if (
        contract.offset <=
          after ||
        !isCantonTemplate(
          contract.templateId,
          "MlsDelivery",
        )
      ) {
        continue;
      }

      const args =
        contract.createArgument;

      if (
        readString(
          args,
          "recipient",
        ) !== activeParty ||
        readString(
          args,
          "recipientInstallationId",
        ) !== installationId
      ) {
        continue;
      }

      const kind =
        readString(
          args,
          "kind",
        );

      if (
        kind !== "commit" &&
        kind !== "welcome"
      ) {
        throw new Error(
          `Invalid Canton MLS delivery kind: ${kind}`,
        );
      }

      items.push({
        id:
          readString(
            args,
            "deliveryId",
          ),
        sequence:
          contract.offset,
        conversationId:
          readString(
            args,
            "channelId",
          ),
        senderInstallationId:
          readString(
            args,
            "senderInstallationId",
          ),
        recipientInstallationId:
          installationId,
        kind,
        sentAt:
          readTimeMs(
            args,
            "createdAt",
          ),
        payload:
          base64ToBytes(
            readString(
              args,
              "payloadB64",
            ),
          ),
      });
    }

    items.sort(
      (left, right) =>
        left.sequence <
        right.sequence
          ? -1
          : left.sequence >
              right.sequence
            ? 1
            : 0,
    );

    const last =
      items.at(-1);

    return {
      items,
      ...(last
        ? {
            nextCursor:
              `h:${last.sequence}`,
          }
        : {}),
    };
  }

  async publishCiphertext(
    envelope:
      CiphertextEnvelope,
  ): Promise<void> {
    const sender =
      await this.directory
        .partyForInstallation(
          envelope
            .senderInstallationId,
        );

    const activeParty =
      this.directory
        .activeParty();

    if (
      sender !== activeParty
    ) {
      throw new Error(
        "Ciphertext sender installation does not belong to active Canton party",
      );
    }

    const recipients =
      uniqueParties(
        await this.directory
          .recipientsForConversation(
            envelope
              .conversationId,
          ),
      ).filter(
        (party) =>
          party !== sender,
      );

    if (
      recipients.length === 0
    ) {
      throw new Error(
        "Encrypted Canton message has no recipients",
      );
    }

    await this.ledger.submitCreates({
      actingParty:
        sender,
      commandId:
        commandId(
          "encrypted-message",
        ),
      creates: [
        {
          templateId:
            cantonMessagingTemplates
              .message,

          createArguments: {
            messageId:
              envelope.id,
            channelId:
              envelope
                .conversationId,
            sender,
            senderInstallationId:
              envelope
                .senderInstallationId,
            recipients,
            epoch:
              envelope.epoch
                .toString(),
            ciphertextB64:
              bytesToBase64(
                envelope.payload,
              ),
            createdAt:
              toDamlTime(
                envelope.sentAt,
              ),
          },
        },
      ],
    });
  }

  async fetchCiphertexts(
    conversationId:
      ConversationId,
    cursor?: string,
  ): Promise<{
    items:
      readonly CiphertextEnvelope[];
    nextCursor?: string;
  }> {
    const party =
      this.directory
        .activeParty();

    const after =
      parseCursor(
        cursor,
        "c",
      );

    const contracts =
      await this.ledger
        .queryActiveContracts(
          party,
        );

    const rows =
      contracts
        .filter(
          (contract) =>
            contract.offset >
              after &&
            isCantonTemplate(
              contract.templateId,
              "EncryptedMessage",
            ) &&
            readString(
              contract
                .createArgument,
              "channelId",
            ) ===
              conversationId,
        )
        .sort(
          (left, right) =>
            left.offset <
            right.offset
              ? -1
              : left.offset >
                  right.offset
                ? 1
                : 0,
        );

    const items =
      rows.map(
        (
          contract,
        ): CiphertextEnvelope => {
          const args =
            contract
              .createArgument;

          return {
            id:
              readString(
                args,
                "messageId",
              ),
            conversationId,
            senderInstallationId:
              readString(
                args,
                "senderInstallationId",
              ),
            epoch:
              BigInt(
                readString(
                  args,
                  "epoch",
                ),
              ),
            sentAt:
              readTimeMs(
                args,
                "createdAt",
              ),
            payload:
              base64ToBytes(
                readString(
                  args,
                  "ciphertextB64",
                ),
              ),
          };
        },
      );

    const last =
      rows.at(-1);

    return {
      items,
      ...(last
        ? {
            nextCursor:
              `c:${last.offset}`,
          }
        : {}),
    };
  }
}

function commandId(
  prefix: string,
): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function toDamlTime(
  milliseconds: number,
): string {
  return new Date(
    milliseconds,
  ).toISOString();
}

function readTimeMs(
  value:
    Record<string, unknown>,
  key: string,
): number {
  const text =
    readString(
      value,
      key,
    );

  const result =
    Date.parse(text);

  if (
    !Number.isFinite(result)
  ) {
    throw new Error(
      `Invalid Canton Time field: ${key}`,
    );
  }

  return result;
}

function readString(
  value:
    Record<string, unknown>,
  key: string,
): string {
  const result =
    value[key];

  if (
    typeof result !== "string"
  ) {
    throw new Error(
      `Invalid Canton field: ${key}`,
    );
  }

  return result;
}

function uniqueParties(
  parties:
    readonly CantonPartyId[],
): CantonPartyId[] {
  return [
    ...new Set(parties),
  ];
}

function parseCursor(
  cursor:
    | string
    | undefined,
  prefix: "h" | "c",
): bigint {
  if (!cursor) {
    return 0n;
  }

  const match =
    new RegExp(
      `^${prefix}:(\\d+)$`,
    ).exec(cursor);

  if (!match?.[1]) {
    throw new Error(
      `Invalid ${prefix} cursor`,
    );
  }

  return BigInt(match[1]);
}
