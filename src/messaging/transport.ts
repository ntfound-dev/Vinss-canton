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

export interface MessagingTransport {
  publishKeyPackage(envelope: KeyPackageEnvelope): Promise<void>;
  fetchKeyPackages(
    installationIds: readonly InstallationId[],
  ): Promise<readonly KeyPackageEnvelope[]>;

  publishCiphertext(envelope: CiphertextEnvelope): Promise<void>;

  fetchCiphertexts(
    conversationId: ConversationId,
    cursor?: string,
  ): Promise<{
    items: readonly CiphertextEnvelope[];
    nextCursor?: string;
  }>;
}
