import type {
  ConversationId,
  GroupMember,
  GroupMetadata,
  GroupSnapshot,
  MessagingIdentity,
} from "../types.js";

export interface OpenMlsBridge {
  initialize(
    identity: MessagingIdentity,
  ): Promise<void>;

  createKeyPackage(): Promise<Uint8Array>;

  createGroup(input: {
    conversationId: ConversationId;
    title: string;
    creator: GroupMember;
  }): Promise<GroupSnapshot>;

  addMembers(input: {
    conversationId: ConversationId;
    members: readonly GroupMember[];
    keyPackages: readonly Uint8Array[];
  }): Promise<{
    commits: readonly Uint8Array[];
    welcomes: readonly Uint8Array[];
    snapshot: GroupSnapshot;
  }>;

  removeMembers(input: {
    conversationId: ConversationId;
    installationIds: readonly string[];
  }): Promise<{
    commits: readonly Uint8Array[];
    snapshot: GroupSnapshot;
  }>;

  joinFromWelcome(input: {
    welcome: Uint8Array;
    metadata: GroupMetadata;
    members: readonly GroupMember[];
  }): Promise<GroupSnapshot>;

  processHandshake(input: {
    conversationId: ConversationId;
    message: Uint8Array;
  }): Promise<GroupSnapshot>;

  encryptApplicationMessage(input: {
    conversationId: ConversationId;
    plaintext: Uint8Array;
  }): Promise<{
    epoch: bigint;
    ciphertext: Uint8Array;
  }>;

  decryptApplicationMessage(input: {
    conversationId: ConversationId;
    ciphertext: Uint8Array;
  }): Promise<{
    epoch: bigint;
    plaintext: Uint8Array;
  }>;

  getGroupSnapshot(
    conversationId: ConversationId,
  ): Promise<GroupSnapshot>;
}
