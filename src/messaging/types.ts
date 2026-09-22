export type ConversationId = string;
export type MessageId = string;
export type UserId = string;
export type InstallationId = string;

export type MemberRole = "member" | "admin" | "super_admin";

export interface MessagingIdentity {
  userId: UserId;
  installationId: InstallationId;
  credential: Uint8Array;
}

export interface GroupMember {
  userId: UserId;
  installationId: InstallationId;
  role: MemberRole;
  credential: Uint8Array;
}

export interface GroupMetadata {
  conversationId: ConversationId;
  title: string;
  createdAt: number;
  createdBy: UserId;
}

export type DealAction =
  | "create_proposal"
  | "amend_proposal"
  | "accept"
  | "reject"
  | "submit_fulfillment"
  | "approve_fulfillment"
  | "open_dispute"
  | "request_settlement";

export type MessageContent =
  | { type: "text"; text: string }
  | { type: "reply"; replyTo: MessageId; text: string }
  | { type: "reaction"; target: MessageId; emoji: string }
  | { type: "read_receipt"; target: MessageId; readAt: number }
  | {
      type: "attachment";
      attachmentId: string;
      mimeType: string;
      size: number;
      digest: string;
    }
  | {
      type: "deal_proposal";
      dealId: string;
      canonicalTerms: string;
      termsHash: string;
    }
  | {
      type: "deal_action";
      dealId: string;
      action: DealAction;
      cantonContractId?: string;
    };

export interface PlainMessage {
  id: MessageId;
  conversationId: ConversationId;
  senderUserId: UserId;
  senderInstallationId: InstallationId;
  sentAt: number;
  content: MessageContent;
}

export interface CiphertextEnvelope {
  id: MessageId;
  conversationId: ConversationId;
  senderInstallationId: InstallationId;
  epoch: bigint;
  sentAt: number;
  payload: Uint8Array;
}

export interface GroupSnapshot {
  metadata: GroupMetadata;
  epoch: bigint;
  members: readonly GroupMember[];
}
