import type {
  ConversationId,
  GroupMember,
  GroupSnapshot,
  MessagingIdentity,
  PlainMessage,
} from "./types.js";

export interface SecureMessagingProvider {
  initialize(identity: MessagingIdentity): Promise<void>;

  createGroup(input: {
    conversationId: ConversationId;
    title: string;
    creator: GroupMember;
  }): Promise<GroupSnapshot>;

  addMembers(
    conversationId: ConversationId,
    members: readonly GroupMember[],
  ): Promise<GroupSnapshot>;

  removeMembers(
    conversationId: ConversationId,
    installationIds: readonly string[],
  ): Promise<GroupSnapshot>;

  send(message: PlainMessage): Promise<void>;

  sync(
    conversationId: ConversationId,
    cursor?: string,
  ): Promise<{
    messages: readonly PlainMessage[];
    nextCursor?: string;
  }>;
}
