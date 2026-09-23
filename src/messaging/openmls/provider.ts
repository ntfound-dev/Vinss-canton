import {
  decodeSecurePayload,
  encodeSecurePayload,
} from "../content.js";
import type {
  SecureMessagingProvider,
} from "../provider.js";
import type {
  MessagingTransport,
  MlsHandshakeDelivery,
} from "../transport.js";
import type {
  ConversationId,
  GroupMember,
  GroupSnapshot,
  MessagingIdentity,
  PlainMessage,
} from "../types.js";
import type {
  OpenMlsBridge,
} from "./bridge.js";
import {
  buildAddHandshakeDeliveries,
  buildRemoveHandshakeDeliveries,
} from "./handshake.js";
import {
  syncMlsHandshakes,
} from "./handshake-sync.js";

const DEFAULT_KEY_PACKAGE_TTL_MS =
  24 * 60 * 60 * 1000;

export class OpenMlsMessagingProvider
  implements SecureMessagingProvider
{
  #identity:
    | MessagingIdentity
    | undefined;

  #handshakeCursor:
    | string
    | undefined;

  constructor(
    private readonly bridge: OpenMlsBridge,
    private readonly transport: MessagingTransport,
    private readonly keyPackageTtlMs =
      DEFAULT_KEY_PACKAGE_TTL_MS,
  ) {}

  async initialize(
    identity: MessagingIdentity,
  ): Promise<void> {
    this.#identity = identity;
    this.#handshakeCursor =
      undefined;

    await this.bridge.initialize(
      identity,
    );

    const keyPackage =
      await this.bridge.createKeyPackage();

    const createdAt = Date.now();

    await this.transport.publishKeyPackage({
      installationId:
        identity.installationId,
      createdAt,
      expiresAt:
        createdAt +
        this.keyPackageTtlMs,
      keyPackage,
    });
  }

  async createGroup(input: {
    conversationId: ConversationId;
    title: string;
    creator: GroupMember;
  }): Promise<GroupSnapshot> {
    this.requireInitialized();

    return this.bridge.createGroup(
      input,
    );
  }

  async addMembers(
    conversationId: ConversationId,
    members: readonly GroupMember[],
  ): Promise<GroupSnapshot> {
    const identity =
      this.requireInitialized();

    const packages =
      await this.transport.fetchKeyPackages(
        members.map(
          (member) =>
            member.installationId,
        ),
      );

    const byInstallation =
      new Map(
        packages.map((pkg) => [
          pkg.installationId,
          pkg,
        ]),
      );

    let snapshot =
      await this.bridge.getGroupSnapshot(
        conversationId,
      );

    for (const member of members) {
      const pkg =
        byInstallation.get(
          member.installationId,
        );

      if (!pkg) {
        throw new Error(
          `Missing MLS KeyPackage for installation ${member.installationId}`,
        );
      }

      if (pkg.expiresAt <= Date.now()) {
        throw new Error(
          `Expired MLS KeyPackage for installation ${member.installationId}`,
        );
      }

      const prepared =
        await this.bridge.prepareAddMember({
          conversationId,
          member,
          keyPackage: pkg.keyPackage,
        });

      const deliveries =
        buildAddHandshakeDeliveries({
          sender: identity,
          snapshot,
          newMember: member,
          commit: prepared.commit,
          welcome: prepared.welcome,
          sentAt: Date.now(),
        });

      await this.publishOrDiscard(
        conversationId,
        deliveries,
      );

      snapshot =
        await this.bridge.mergePendingCommit(
          conversationId,
        );

      await this.publishGroupState(
        snapshot,
      );
    }

    return snapshot;
  }

  async removeMembers(
    conversationId: ConversationId,
    installationIds:
      readonly string[],
  ): Promise<GroupSnapshot> {
    const identity =
      this.requireInitialized();

    let snapshot =
      await this.bridge.getGroupSnapshot(
        conversationId,
      );

    for (
      const installationId
      of installationIds
    ) {
      const prepared =
        await this.bridge.prepareRemoveMember({
          conversationId,
          installationId,
        });

      const deliveries =
        buildRemoveHandshakeDeliveries({
          sender: identity,
          snapshot,
          removedInstallationId:
            installationId,
          commit: prepared.commit,
          sentAt: Date.now(),
        });

      await this.publishOrDiscard(
        conversationId,
        deliveries,
      );

      snapshot =
        await this.bridge.mergePendingCommit(
          conversationId,
        );

      await this.publishGroupState(
        snapshot,
      );
    }

    return snapshot;
  }

  async send(
    message: PlainMessage,
  ): Promise<void> {
    const identity =
      this.requireInitialized();

    if (
      message.senderInstallationId !==
      identity.installationId
    ) {
      throw new Error(
        "Sender installation does not match active identity",
      );
    }

    const encrypted =
      await this.bridge
        .encryptApplicationMessage({
          conversationId:
            message.conversationId,
          plaintext:
            encodeSecurePayload({
              kind: "message",
              message,
            }),
        });

    await this.transport
      .publishCiphertext({
        id: message.id,
        conversationId:
          message.conversationId,
        senderInstallationId:
          identity.installationId,
        epoch: encrypted.epoch,
        sentAt: message.sentAt,
        payload:
          encrypted.ciphertext,
      });
  }

  async sync(
    conversationId: ConversationId,
    cursor?: string,
  ): Promise<{
    messages:
      readonly PlainMessage[];
    nextCursor?: string;
  }> {
    const identity =
      this.requireInitialized();

    const handshakeResult =
      await syncMlsHandshakes({
        bridge: this.bridge,
        transport: this.transport,
        identity,
        ...(this.#handshakeCursor
          ? {
              cursor:
                this.#handshakeCursor,
            }
          : {}),
      });

    if (
      handshakeResult.nextCursor !==
      undefined
    ) {
      this.#handshakeCursor =
        handshakeResult.nextCursor;
    }

    const result =
      await this.transport
        .fetchCiphertexts(
          conversationId,
          cursor,
        );

    const messages:
      PlainMessage[] = [];

    for (
      const envelope
      of result.items
    ) {
      const decrypted =
        await this.bridge
          .decryptApplicationMessage({
            conversationId,
            ciphertext:
              envelope.payload,
          });

      if (
        decrypted.epoch !==
        envelope.epoch
      ) {
        throw new Error(
          "MLS epoch mismatch",
        );
      }

      const securePayload =
        decodeSecurePayload(
          decrypted.plaintext,
        );

      if (
        securePayload.kind ===
        "group_state"
      ) {
        if (
          securePayload.snapshot
            .metadata
            .conversationId !==
          conversationId
        ) {
          throw new Error(
            "Encrypted group state conversation mismatch",
          );
        }

        if (
          securePayload.snapshot
            .epoch !==
          decrypted.epoch
        ) {
          throw new Error(
            "Encrypted group state epoch mismatch",
          );
        }

        await this.bridge
          .applyGroupSnapshot(
            securePayload.snapshot,
          );

        continue;
      }

      const message =
        securePayload.message;

      if (
        message.id !==
        envelope.id
      ) {
        throw new Error(
          "Message envelope ID mismatch",
        );
      }

      messages.push(message);
    }

    return {
      messages,
      ...(result.nextCursor
        ? {
            nextCursor:
              result.nextCursor,
          }
        : {}),
    };
  }

  private async publishGroupState(
    snapshot: GroupSnapshot,
  ): Promise<void> {
    const identity =
      this.requireInitialized();

    const encrypted =
      await this.bridge
        .encryptApplicationMessage({
          conversationId:
            snapshot.metadata
              .conversationId,
          plaintext:
            encodeSecurePayload({
              kind: "group_state",
              snapshot,
            }),
        });

    if (
      encrypted.epoch !==
      snapshot.epoch
    ) {
      throw new Error(
        "MLS group state encryption epoch mismatch",
      );
    }

    await this.transport
      .publishCiphertext({
        id:
          `group-state:${snapshot.metadata.conversationId}:${snapshot.epoch}:${globalThis.crypto.randomUUID()}`,
        conversationId:
          snapshot.metadata
            .conversationId,
        senderInstallationId:
          identity.installationId,
        epoch:
          encrypted.epoch,
        sentAt:
          Date.now(),
        payload:
          encrypted.ciphertext,
      });
  }

  private async publishOrDiscard(
    conversationId: ConversationId,
    deliveries:
      readonly MlsHandshakeDelivery[],
  ): Promise<void> {
    if (deliveries.length === 0) {
      return;
    }

    try {
      await this.transport
        .publishHandshakes(
          deliveries,
        );
    } catch (publishError) {
      try {
        await this.bridge
          .clearPendingCommit(
            conversationId,
          );
      } catch (clearError) {
        throw new AggregateError(
          [
            publishError,
            clearError,
          ],
          "MLS delivery failed and pending commit could not be cleared",
        );
      }

      throw publishError;
    }
  }

  private requireInitialized():
    MessagingIdentity {
    if (!this.#identity) {
      throw new Error(
        "Secure messaging provider is not initialized",
      );
    }

    return this.#identity;
  }
}
