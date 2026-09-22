import type {
  CiphertextEnvelope,
  ConversationId,
  InstallationId,
} from "./types.js";

export interface KeyPackageEnvelope {
  installationId: InstallationId;
  createdAt: number;
  expiresAt: number;
  keyPackage: Uint8Array;
}

export type MlsHandshakeKind =
  | "commit"
  | "welcome";

export interface MlsHandshakeDelivery {
  conversationId: ConversationId;
  kind: MlsHandshakeKind;
  senderInstallationId: InstallationId;
  recipientInstallationId: InstallationId;
  sentAt: number;
  payload: Uint8Array;
}

export interface MlsHandshakeEnvelope
  extends MlsHandshakeDelivery {
  id: string;

  // Assigned by the relay. Fetch results must be ordered ascending.
  sequence: bigint;
}

export interface MessagingTransport {
  publishKeyPackage(
    envelope: KeyPackageEnvelope,
  ): Promise<void>;

  fetchKeyPackages(
    installationIds: readonly InstallationId[],
  ): Promise<readonly KeyPackageEnvelope[]>;

  /**
   * The relay must persist this batch atomically.
   *
   * Either every delivery is accepted or none are.
   * This prevents members from observing different MLS commits.
   */
  publishHandshakes(
    deliveries: readonly MlsHandshakeDelivery[],
  ): Promise<void>;

  fetchHandshakes(
    installationId: InstallationId,
    cursor?: string,
  ): Promise<{
    items: readonly MlsHandshakeEnvelope[];
    nextCursor?: string;
  }>;

  publishCiphertext(
    envelope: CiphertextEnvelope,
  ): Promise<void>;

  fetchCiphertexts(
    conversationId: ConversationId,
    cursor?: string,
  ): Promise<{
    items: readonly CiphertextEnvelope[];
    nextCursor?: string;
  }>;
}
