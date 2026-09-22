import type {
  ConversationId,
  GroupMember,
  GroupSnapshot,
  MessagingIdentity,
} from "../types.js";

/**
 * Browser-safe boundary around the compiled OpenMLS WASM module.
 *
 * IMPORTANT:
 * - Implement this with OpenMLS/WASM.
 * - Do not replace these methods with home-grown group crypto.
 * - MLS private state remains client-side.
 */
export interface OpenMlsBridge {
  initialize(identity: MessagingIdentity): Promise<void>;

  createKeyPackage(): Promise<Uint8Array>;

  createGroup(input: {
    conversationId: ConversationId;
    title: string;
    creator: GroupMember;
  }): Promise<GroupSnapshot>;

  addMembers(input: {
    conversationId: ConversationId;
    keyPackages: readonly Uint8Array[];
  }): Promise<{
    commit: Uint8Array;
    welcomes: readonly Uint8Array[];
    snapshot: GroupSnapshot;
  }>;

  removeMembers(input: {
    conversationId: ConversationId;
    installationIds: readonly string[];
  }): Promise<{
    commit: Uint8Array;
    snapshot: GroupSnapshot;
  }>;

  joinFromWelcome(input: {
    welcome: Uint8Array;
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

  exportEncryptedState(): Promise<Uint8Array>;
  importEncryptedState(blob: Uint8Array): Promise<void>;
}
