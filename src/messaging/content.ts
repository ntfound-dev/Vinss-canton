import type {
  GroupMember,
  GroupSnapshot,
  MessageContent,
  PlainMessage,
} from "./types.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const TYPE_KEY = "__vinssSecureType";

export type SecurePayload =
  | {
      kind: "message";
      message: PlainMessage;
    }
  | {
      kind: "group_state";
      snapshot: GroupSnapshot;
    };

export function encodeSecurePayload(
  payload: SecurePayload,
): Uint8Array {
  return encoder.encode(
    JSON.stringify(
      payload,
      (_key, value) => {
        if (
          value instanceof Uint8Array
        ) {
          return {
            [TYPE_KEY]: "bytes",
            value: Array.from(value),
          };
        }

        if (
          typeof value === "bigint"
        ) {
          return {
            [TYPE_KEY]: "bigint",
            value: value.toString(),
          };
        }

        return value;
      },
    ),
  );
}

export function decodeSecurePayload(
  bytes: Uint8Array,
): SecurePayload {
  const value: unknown =
    JSON.parse(
      decoder.decode(bytes),
      (_key, current) => {
        if (!isRecord(current)) {
          return current;
        }

        if (
          current[TYPE_KEY] === "bytes" &&
          Array.isArray(
            current.value,
          )
        ) {
          return new Uint8Array(
            current.value,
          );
        }

        if (
          current[TYPE_KEY] === "bigint" &&
          typeof current.value ===
            "string"
        ) {
          if (
            !/^\d+$/.test(
              current.value,
            )
          ) {
            throw new Error(
              "Invalid secure bigint",
            );
          }

          return BigInt(
            current.value,
          );
        }

        return current;
      },
    );

  if (!isRecord(value)) {
    throw new Error(
      "Invalid VINSS secure payload",
    );
  }

  if (
    value.kind === "message" &&
    isPlainMessage(
      value.message,
    )
  ) {
    return {
      kind: "message",
      message: value.message,
    };
  }

  if (
    value.kind === "group_state" &&
    isGroupSnapshot(
      value.snapshot,
    )
  ) {
    return {
      kind: "group_state",
      snapshot: value.snapshot,
    };
  }

  throw new Error(
    "Invalid VINSS secure payload",
  );
}

// Compatibility helpers for ordinary chat payloads.
export function encodeMessage(
  message: PlainMessage,
): Uint8Array {
  return encodeSecurePayload({
    kind: "message",
    message,
  });
}

export function decodeMessage(
  bytes: Uint8Array,
): PlainMessage {
  const payload =
    decodeSecurePayload(bytes);

  if (
    payload.kind !== "message"
  ) {
    throw new Error(
      "Expected VINSS message payload",
    );
  }

  return payload.message;
}

export function isPlainMessage(
  value: unknown,
): value is PlainMessage {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.conversationId ===
      "string" &&
    typeof value.senderUserId ===
      "string" &&
    typeof value
      .senderInstallationId ===
      "string" &&
    typeof value.sentAt ===
      "number" &&
    isMessageContent(
      value.content,
    )
  );
}

function isGroupSnapshot(
  value: unknown,
): value is GroupSnapshot {
  if (
    !isRecord(value) ||
    typeof value.epoch !==
      "bigint" ||
    !isRecord(value.metadata) ||
    !Array.isArray(
      value.members,
    )
  ) {
    return false;
  }

  const metadata =
    value.metadata;

  return (
    typeof metadata
      .conversationId ===
      "string" &&
    typeof metadata.title ===
      "string" &&
    typeof metadata.createdAt ===
      "number" &&
    typeof metadata.createdBy ===
      "string" &&
    value.members.every(
      isGroupMember,
    )
  );
}

function isGroupMember(
  value: unknown,
): value is GroupMember {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.userId ===
      "string" &&
    typeof value.installationId ===
      "string" &&
    (
      value.role === "member" ||
      value.role === "admin" ||
      value.role ===
        "super_admin"
    ) &&
    value.credential instanceof
      Uint8Array
  );
}

function isMessageContent(
  value: unknown,
): value is MessageContent {
  if (
    !isRecord(value) ||
    typeof value.type !==
      "string"
  ) {
    return false;
  }

  switch (value.type) {
    case "text":
      return (
        typeof value.text ===
        "string"
      );

    case "reply":
      return (
        typeof value.replyTo ===
          "string" &&
        typeof value.text ===
          "string"
      );

    case "reaction":
      return (
        typeof value.target ===
          "string" &&
        typeof value.emoji ===
          "string"
      );

    case "read_receipt":
      return (
        typeof value.target ===
          "string" &&
        typeof value.readAt ===
          "number"
      );

    case "attachment":
      return (
        typeof value
          .attachmentId ===
          "string" &&
        typeof value.mimeType ===
          "string" &&
        typeof value.size ===
          "number" &&
        typeof value.digest ===
          "string"
      );

    case "deal_proposal":
      return (
        typeof value.dealId ===
          "string" &&
        typeof value
          .canonicalTerms ===
          "string" &&
        typeof value.termsHash ===
          "string" &&
        typeof value
          .cantonContractId ===
          "string"
      );

    case "deal_action":
      return (
        typeof value.dealId ===
          "string" &&
        typeof value.action ===
          "string"
      );

    default:
      return false;
  }
}

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
