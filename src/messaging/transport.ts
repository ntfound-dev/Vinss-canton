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

interface MlsHandshakeBase {
  id?: string;
  conversationId: ConversationId;
  senderInstallationId: InstallationId;
  recipientInstallationId: InstallationId;
  sentAt: number;
  payload: Uint8Array;
}

export interface MlsCommitDelivery
  extends MlsHandshakeBase {
  kind: "commit";
}

export interface MlsWelcomeDelivery
  extends MlsHandshakeBase {
  kind: "welcome";
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

  publishHandshakes(
    deliveries:
      readonly MlsHandshakeDelivery[],
  ): Promise<void>;

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
