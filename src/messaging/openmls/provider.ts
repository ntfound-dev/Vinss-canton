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
  OpenMlsPendingCommitRecovery,
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

    await this.bridge.initialize(
      identity,
    );

    this.#handshakeCursor =
      await this.bridge
        .getHandshakeCursor?.();

    await this.recoverPendingWork(
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
    const identity =
      this.requireInitialized();

    await this.recoverPendingWork(
      identity,
    );

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

    await this.recoverPendingWork(
      identity,
    );

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

    await this.recoverPendingWork(
      identity,
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

      await this.bridge.prepareAddMember({
        conversationId,
        member,
        keyPackage: pkg.keyPackage,
      });

      snapshot =
        await this.finishPendingCommit(
          conversationId,
          identity,
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
      await this.bridge.prepareRemoveMember({
        conversationId,
        installationId,
      });

      snapshot =
        await this.finishPendingCommit(
          conversationId,
          identity,
        );
    }

    return snapshot;
  }

  async send(
    message: PlainMessage,
  ): Promise<void> {
    const identity =
      this.requireInitialized();

    await this.recoverPendingWork(
      identity,
    );

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

    await this.recoverPendingWork(
      identity,
    );

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
      await this.bridge
        .saveHandshakeCursor?.(
          handshakeResult
            .nextCursor,
        );

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
      // Sender already owns the plaintext.
      // Do not process our own MLS ciphertext again.
      if (
        envelope
          .senderInstallationId ===
        identity.installationId
      ) {
        continue;
      }

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

  private async recoverPendingWork(
    identity:
      MessagingIdentity,
  ): Promise<void> {
    const pending =
      await this.bridge
        .listPendingOutboundCommits?.() ??
      [];

    for (
      const item
      of pending
    ) {
      await this.finishPendingCommit(
        item.conversationId,
        identity,
        item,
      );
    }

    const unpublished =
      await this.bridge
        .listGroupsNeedingStatePublish?.() ??
      [];

    for (
      const snapshot
      of unpublished
    ) {
      await this.publishGroupState(
        snapshot,
      );

      await this.bridge
        .markGroupStatePublished?.(
          snapshot.metadata
            .conversationId,
        );
    }
  }

  private async finishPendingCommit(
    conversationId:
      ConversationId,

    identity:
      MessagingIdentity,

    known?:
      OpenMlsPendingCommitRecovery,
  ): Promise<GroupSnapshot> {
    const pending =
      known ??
      (
        await this.bridge
          .listPendingOutboundCommits?.() ??
        []
      ).find(
        (item) =>
          item.conversationId ===
          conversationId,
      );

    if (!pending) {
      throw new Error(
        `MLS pending outbound commit not found: ${conversationId}`,
      );
    }

    let deliveries:
      readonly MlsHandshakeDelivery[];

    if (
      pending.change.type ===
        "add"
    ) {
      if (!pending.welcome) {
        throw new Error(
          "MLS add recovery is missing Welcome",
        );
      }

      deliveries =
        buildAddHandshakeDeliveries({
          sender:
            identity,

          snapshot:
            pending.snapshot,

          newMember:
            pending.change
              .member,

          commit:
            pending.commit,

          welcome:
            pending.welcome,

          sentAt:
            pending.sentAt,
        });
    } else {
      deliveries =
        buildRemoveHandshakeDeliveries({
          sender:
            identity,

          snapshot:
            pending.snapshot,

          removedInstallationId:
            pending.change
              .installationId,

          commit:
            pending.commit,

          sentAt:
            pending.sentAt,
        });
    }

    const durableDeliveries =
      deliveries.map(
        (delivery) => ({
          ...delivery,

          id:
            durableHandshakeId(
              delivery,
              pending
                .targetEpoch,
            ),
        }),
      );

    if (
      durableDeliveries.length >
      0
    ) {
      await this.transport
        .publishHandshakes(
          durableDeliveries,
        );
    }

    const snapshot =
      await this.bridge
        .mergePendingCommit(
          conversationId,
        );

    await this.publishGroupState(
      snapshot,
    );

    await this.bridge
      .markGroupStatePublished?.(
        conversationId,
      );

    return snapshot;
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


function durableHandshakeId(
  delivery:
    MlsHandshakeDelivery,
  targetEpoch:
    bigint,
): string {
  return [
    "mls",
    encodeURIComponent(
      delivery.conversationId,
    ),
    targetEpoch.toString(),
    delivery.kind,
    encodeURIComponent(
      delivery
        .senderInstallationId,
    ),
    encodeURIComponent(
      delivery
        .recipientInstallationId,
    ),
  ].join(":");
}
