import type {
  ConversationId,
  GroupMember,
  GroupSnapshot,
  MessagingIdentity,
} from "../types.js";

import type {
  OpenMlsPendingOutboundCommit,
} from "./checkpoint.js";

export interface OpenMlsPendingCommitRecovery
  extends OpenMlsPendingOutboundCommit {
  conversationId:
    ConversationId;

  snapshot:
    GroupSnapshot;
}

export interface OpenMlsBridge {
  initialize(
    identity: MessagingIdentity,
  ): Promise<void>;

  createKeyPackage():
    Promise<Uint8Array>;

  createGroup(input: {
    conversationId:
      ConversationId;
    title: string;
    creator: GroupMember;
  }): Promise<GroupSnapshot>;

  prepareAddMember(input: {
    conversationId:
      ConversationId;
    member: GroupMember;
    keyPackage: Uint8Array;
  }): Promise<{
    commit: Uint8Array;
    welcome: Uint8Array;
  }>;

  prepareRemoveMember(input: {
    conversationId:
      ConversationId;
    installationId: string;
  }): Promise<{
    commit: Uint8Array;
  }>;

  mergePendingCommit(
    conversationId:
      ConversationId,
  ): Promise<GroupSnapshot>;

  clearPendingCommit(
    conversationId:
      ConversationId,
  ): Promise<void>;

  joinFromWelcome(input: {
    welcome: Uint8Array;
    conversationId:
      ConversationId;
    handshakeId?: string;
  }): Promise<GroupSnapshot>;

  processHandshake(input: {
    conversationId:
      ConversationId;
    message: Uint8Array;
    handshakeId?: string;
  }): Promise<GroupSnapshot>;

  getHandshakeCursor?():
    Promise<string | undefined>;

  saveHandshakeCursor?(
    cursor: string,
  ): Promise<void>;

  hasProcessedHandshake?(
    handshakeId: string,
  ): Promise<boolean>;

  listPendingOutboundCommits?():
    Promise<
      readonly OpenMlsPendingCommitRecovery[]
    >;

  listGroupsNeedingStatePublish?():
    Promise<
      readonly GroupSnapshot[]
    >;

  markGroupStatePublished?(
    conversationId:
      ConversationId,
  ): Promise<void>;

  applyGroupSnapshot(
    snapshot: GroupSnapshot,
  ): Promise<GroupSnapshot>;

  encryptApplicationMessage(
    input: {
      conversationId:
        ConversationId;
      plaintext: Uint8Array;
    },
  ): Promise<{
    epoch: bigint;
    ciphertext: Uint8Array;
  }>;

  decryptApplicationMessage(
    input: {
      conversationId:
        ConversationId;
      ciphertext: Uint8Array;
    },
  ): Promise<{
    epoch: bigint;
    plaintext: Uint8Array;
  }>;

  getGroupSnapshot(
    conversationId:
      ConversationId,
  ): Promise<GroupSnapshot>;
}
