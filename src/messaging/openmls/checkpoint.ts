import type {
  GroupMember,
  GroupSnapshot,
  InstallationId,
} from "../types.js";

export interface OpenMlsPersistedGroup {
  snapshot: GroupSnapshot;
  hydrated: boolean;
}

export interface OpenMlsCheckpoint {
  version: 1;

  identityKey: string;

  identityPublicKey:
    Uint8Array;

  providerStorage:
    Uint8Array;

  groups:
    readonly OpenMlsPersistedGroup[];

  handshakeCursor?: string;

  processedHandshakeIds:
    readonly string[];
}

export interface OpenMlsCheckpointStore {
  load(
    installationId:
      InstallationId,
  ): Promise<
    OpenMlsCheckpoint | undefined
  >;

  save(
    installationId:
      InstallationId,
    checkpoint:
      OpenMlsCheckpoint,
  ): Promise<void>;

  clear(
    installationId:
      InstallationId,
  ): Promise<void>;
}

const TYPE_KEY =
  "__vinssOpenMlsType";

const encoder =
  new TextEncoder();

const decoder =
  new TextDecoder();

export function encodeOpenMlsCheckpoint(
  checkpoint:
    OpenMlsCheckpoint,
): Uint8Array {
  return encoder.encode(
    JSON.stringify(
      checkpoint,
      (_key, value) => {
        if (
          value instanceof
          Uint8Array
        ) {
          return {
            [TYPE_KEY]:
              "bytes",

            value:
              Array.from(value),
          };
        }

        if (
          typeof value ===
          "bigint"
        ) {
          return {
            [TYPE_KEY]:
              "bigint",

            value:
              value.toString(),
          };
        }

        return value;
      },
    ),
  );
}

export function decodeOpenMlsCheckpoint(
  bytes: Uint8Array,
): OpenMlsCheckpoint {
  const value: unknown =
    JSON.parse(
      decoder.decode(bytes),

      (_key, current) => {
        if (
          !isRecord(current)
        ) {
          return current;
        }

        if (
          current[TYPE_KEY] ===
            "bytes" &&
          Array.isArray(
            current.value,
          ) &&
          current.value.every(
            (item) =>
              Number.isInteger(
                item,
              ) &&
              item >= 0 &&
              item <= 255,
          )
        ) {
          return new Uint8Array(
            current.value,
          );
        }

        if (
          current[TYPE_KEY] ===
            "bigint" &&
          typeof current.value ===
            "string" &&
          /^\d+$/.test(
            current.value,
          )
        ) {
          return BigInt(
            current.value,
          );
        }

        return current;
      },
    );

  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.identityKey !==
      "string" ||
    !(value.identityPublicKey
      instanceof Uint8Array) ||
    !(value.providerStorage
      instanceof Uint8Array) ||
    !Array.isArray(
      value.groups,
    ) ||
    !value.groups.every(
      isPersistedGroup,
    ) ||
    (
      value.handshakeCursor !==
        undefined &&
      typeof value.handshakeCursor !==
        "string"
    ) ||
    (
      value.processedHandshakeIds !==
        undefined &&
      (
        !Array.isArray(
          value.processedHandshakeIds,
        ) ||
        !value.processedHandshakeIds.every(
          (item: unknown) =>
            typeof item ===
              "string",
        )
      )
    )
  ) {
    throw new Error(
      "Invalid VINSS OpenMLS checkpoint",
    );
  }

  return {
    version: 1,

    identityKey:
      value.identityKey,

    identityPublicKey:
      value.identityPublicKey,

    providerStorage:
      value.providerStorage,

    groups:
      value.groups,

    ...(typeof value.handshakeCursor ===
      "string"
      ? {
          handshakeCursor:
            value.handshakeCursor,
        }
      : {}),

    processedHandshakeIds:
      Array.isArray(
        value.processedHandshakeIds,
      )
        ? value.processedHandshakeIds
        : [],
  };
}

function isPersistedGroup(
  value: unknown,
): value is OpenMlsPersistedGroup {
  return (
    isRecord(value) &&
    typeof value.hydrated ===
      "boolean" &&
    isGroupSnapshot(
      value.snapshot,
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
    !isRecord(
      value.metadata,
    ) ||
    !Array.isArray(
      value.members,
    )
  ) {
    return false;
  }

  return (
    typeof value.metadata
      .conversationId ===
      "string" &&
    typeof value.metadata
      .title ===
      "string" &&
    typeof value.metadata
      .createdAt ===
      "number" &&
    typeof value.metadata
      .createdBy ===
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

function isRecord(
  value: unknown,
): value is Record<
  string,
  any
> {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
