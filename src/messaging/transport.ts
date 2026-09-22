import type {
  CiphertextEnvelope,
  ConversationId,
  GroupMember,
  GroupMembershipChange,
  GroupMetadata,
  InstallationId,
} from "./types.js";

export interface KeyPackageEnvelope {
  installationId: InstallationId;
  createdAt: number;
  expiresAt: number;
  keyPackage: Uint8Array;
}

interface MlsHandshakeBase {
  conversationId: ConversationId;
  senderInstallationId: InstallationId;
  recipientInstallationId: InstallationId;
  sentAt: number;
  payload: Uint8Array;
}

export interface MlsCommitDelivery
  extends MlsHandshakeBase {
  kind: "commit";
  change: GroupMembershipChange;
}

export interface MlsWelcomeContext {
  metadata: GroupMetadata;
  members: readonly GroupMember[];
}

export interface MlsWelcomeDelivery
  extends MlsHandshakeBase {
  kind: "welcome";
  context: MlsWelcomeContext;
}

export type MlsHandshakeDelivery =
  | MlsCommitDelivery
  | MlsWelcomeDelivery;

export type MlsHandshakeEnvelope =
  MlsHandshakeDelivery & {
    id: string;
    sequence: bigint;
  };

export interface MessagingTransport {
  publishKeyPackage(
    envelope: KeyPackageEnvelope,
  ): Promise<void>;

  fetchKeyPackages(
    installationIds:
      readonly InstallationId[],
  ): Promise<
    readonly KeyPackageEnvelope[]
  >;

  /**
   * Relay persistence must be atomic.
   * Either the whole MLS delivery batch is accepted or none is.
   */
  publishHandshakes(
    deliveries:
      readonly MlsHandshakeDelivery[],
  ): Promise<void>;

  /**
   * Results must be returned in strictly increasing sequence order.
   */
  fetchHandshakes(
    installationId: InstallationId,
    cursor?: string,
  ): Promise<{
    items:
      readonly MlsHandshakeEnvelope[];
    nextCursor?: string;
  }>;

  publishCiphertext(
    envelope: CiphertextEnvelope,
  ): Promise<void>;

  fetchCiphertexts(
    conversationId: ConversationId,
    cursor?: string,
  ): Promise<{
    items:
      readonly CiphertextEnvelope[];
    nextCursor?: string;
  }>;
}
