import type { MessageContent, PlainMessage } from "./types.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeMessage(message: PlainMessage): Uint8Array {
  return encoder.encode(
    JSON.stringify(message, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
}

export function decodeMessage(bytes: Uint8Array): PlainMessage {
  const value: unknown = JSON.parse(decoder.decode(bytes));
  if (!isPlainMessage(value)) {
    throw new Error("Invalid VINSS message payload");
  }
  return value;
}

export function isPlainMessage(value: unknown): value is PlainMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;

  return (
    typeof v.id === "string" &&
    typeof v.conversationId === "string" &&
    typeof v.senderUserId === "string" &&
    typeof v.senderInstallationId === "string" &&
    typeof v.sentAt === "number" &&
    isMessageContent(v.content)
  );
}

function isMessageContent(value: unknown): value is MessageContent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.type !== "string") return false;

  switch (v.type) {
    case "text":
      return typeof v.text === "string";
    case "reply":
      return typeof v.replyTo === "string" && typeof v.text === "string";
    case "reaction":
      return typeof v.target === "string" && typeof v.emoji === "string";
    case "read_receipt":
      return typeof v.target === "string" && typeof v.readAt === "number";
    case "attachment":
      return (
        typeof v.attachmentId === "string" &&
        typeof v.mimeType === "string" &&
        typeof v.size === "number" &&
        typeof v.digest === "string"
      );
    case "deal_proposal":
      return (
        typeof v.dealId === "string" &&
        typeof v.canonicalTerms === "string" &&
        typeof v.termsHash === "string"
      );
    case "deal_action":
      return typeof v.dealId === "string" && typeof v.action === "string";
    default:
      return false;
  }
}
