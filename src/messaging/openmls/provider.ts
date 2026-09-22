import { decodeMessage, encodeMessage } from "../content.js";
import type { SecureMessagingProvider } from "../provider.js";
import type { MessagingTransport } from "../transport.js";
import type {
  ConversationId,
  GroupMember,
  GroupSnapshot,
  MessagingIdentity,
  PlainMessage,
} from "../types.js";
import type { OpenMlsBridge } from "./bridge.js";

export class OpenMlsMessagingProvider implements SecureMessagingProvider {
  #identity: MessagingIdentity | undefined;

  constructor(
    private readonly bridge: OpenMlsBridge,
    private readonly transport: MessagingTransport,
  ) {}

  async initialize(identity: MessagingIdentity): Promise<void> {
    this.#identity = identity;
    await this.bridge.initialize(identity);
  }

  async createGroup(input: {
    conversationId: ConversationId;
    title: string;
    creator: GroupMember;
  }): Promise<GroupSnapshot> {
    this.requireInitialized();
    return this.bridge.createGroup(input);
  }

  async addMembers(
    conversationId: ConversationId,
    members: readonly GroupMember[],
  ): Promise<GroupSnapshot> {
    this.requireInitialized();

    const packages = await this.transport.fetchKeyPackages(
      members.map((member) => member.installationId),
    );

    const byInstallation = new Map(
      packages.map((pkg) => [pkg.installationId, pkg]),
    );

    const ordered = members.map((member) => {
      const pkg = byInstallation.get(member.installationId);
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
      return pkg.keyPackage;
    });

    const result = await this.bridge.addMembers({
      conversationId,
      members,
      keyPackages: ordered,
    });

    // MLS Commit/Welcome delivery uses a dedicated handshake channel.
    // The relay wiring is the next transport milestone.
    void result.commits;
    void result.welcomes;

    return result.snapshot;
  }

  async removeMembers(
    conversationId: ConversationId,
    installationIds: readonly string[],
  ): Promise<GroupSnapshot> {
    this.requireInitialized();

    const result = await this.bridge.removeMembers({
      conversationId,
      installationIds,
    });

    // Publish these through the dedicated MLS handshake channel.
    void result.commits;
    return result.snapshot;
  }

  async send(message: PlainMessage): Promise<void> {
    const identity = this.requireInitialized();

    if (message.senderInstallationId !== identity.installationId) {
      throw new Error("Sender installation does not match active identity");
    }

    const encrypted = await this.bridge.encryptApplicationMessage({
      conversationId: message.conversationId,
      plaintext: encodeMessage(message),
    });

    await this.transport.publishCiphertext({
      id: message.id,
      conversationId: message.conversationId,
      senderInstallationId: identity.installationId,
      epoch: encrypted.epoch,
      sentAt: message.sentAt,
      payload: encrypted.ciphertext,
    });
  }

  async sync(
    conversationId: ConversationId,
    cursor?: string,
  ): Promise<{
    messages: readonly PlainMessage[];
    nextCursor?: string;
  }> {
    this.requireInitialized();

    const result = await this.transport.fetchCiphertexts(
      conversationId,
      cursor,
    );

    const messages: PlainMessage[] = [];

    for (const envelope of result.items) {
      const decrypted = await this.bridge.decryptApplicationMessage({
        conversationId,
        ciphertext: envelope.payload,
      });

      if (decrypted.epoch !== envelope.epoch) {
        throw new Error("MLS epoch mismatch");
      }

      const message = decodeMessage(decrypted.plaintext);

      if (message.id !== envelope.id) {
        throw new Error("Message envelope ID mismatch");
      }

      messages.push(message);
    }

    return {
      messages,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  }

  private requireInitialized(): MessagingIdentity {
    if (!this.#identity) {
      throw new Error("Secure messaging provider is not initialized");
    }
    return this.#identity;
  }
}
