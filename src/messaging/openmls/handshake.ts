import type {
  GroupMember,
  GroupSnapshot,
  MessagingIdentity,
} from "../types.js";
import type {
  MlsHandshakeDelivery,
} from "../transport.js";

interface AddHandshakeInput {
  sender: MessagingIdentity;
  snapshot: GroupSnapshot;
  newMember: GroupMember;
  commit: Uint8Array;
  welcome: Uint8Array;
  sentAt: number;
}

export function buildAddHandshakeDeliveries(
  input: AddHandshakeInput,
): readonly MlsHandshakeDelivery[] {
  const commitDeliveries =
    existingRecipients(
      input.snapshot,
      input.sender.installationId,
    ).map((recipientInstallationId) => ({
      conversationId:
        input.snapshot.metadata.conversationId,
      kind: "commit" as const,
      senderInstallationId:
        input.sender.installationId,
      recipientInstallationId,
      sentAt: input.sentAt,
      payload: copyBytes(input.commit),
    }));

  const welcome: MlsHandshakeDelivery = {
    conversationId:
      input.snapshot.metadata.conversationId,
    kind: "welcome",
    senderInstallationId:
      input.sender.installationId,
    recipientInstallationId:
      input.newMember.installationId,
    sentAt: input.sentAt,
    payload: copyBytes(input.welcome),
  };

  return [
    ...commitDeliveries,
    welcome,
  ];
}

interface RemoveHandshakeInput {
  sender: MessagingIdentity;
  snapshot: GroupSnapshot;
  removedInstallationId: string;
  commit: Uint8Array;
  sentAt: number;
}

export function buildRemoveHandshakeDeliveries(
  input: RemoveHandshakeInput,
): readonly MlsHandshakeDelivery[] {
  return existingRecipients(
    input.snapshot,
    input.sender.installationId,
  )
    .filter(
      (installationId) =>
        installationId !==
        input.removedInstallationId,
    )
    .map((recipientInstallationId) => ({
      conversationId:
        input.snapshot.metadata.conversationId,
      kind: "commit" as const,
      senderInstallationId:
        input.sender.installationId,
      recipientInstallationId,
      sentAt: input.sentAt,
      payload: copyBytes(input.commit),
    }));
}

function existingRecipients(
  snapshot: GroupSnapshot,
  senderInstallationId: string,
): readonly string[] {
  return snapshot.members
    .map((member) => member.installationId)
    .filter(
      (installationId) =>
        installationId !==
        senderInstallationId,
    );
}

function copyBytes(
  bytes: Uint8Array,
): Uint8Array {
  return new Uint8Array(bytes);
}
