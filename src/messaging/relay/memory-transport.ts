import type {
  KeyPackageEnvelope,
  MessagingTransport,
  MlsHandshakeDelivery,
  MlsHandshakeEnvelope,
} from "../transport.js";

import type {
  CiphertextEnvelope,
  GroupMember,
  GroupMembershipChange,
  InstallationId,
} from "../types.js";

/**
 * Executable reference for VINSS relay semantics.
 *
 * This is NOT production persistence.
 * It defines the behavior that the HTTP/database relay must preserve:
 * - opaque MLS bytes only
 * - atomic handshake batches
 * - per-installation handshake sequencing
 * - cursor-based delivery
 * - no plaintext
 */
export class MemoryMessagingTransport
  implements MessagingTransport
{
  readonly #keyPackages =
    new Map<InstallationId, KeyPackageEnvelope>();

  readonly #handshakes =
    new Map<InstallationId, MlsHandshakeEnvelope[]>();

  readonly #handshakeSequence =
    new Map<InstallationId, bigint>();

  readonly #ciphertexts =
    new Map<string, CiphertextEnvelope[]>();

  async publishKeyPackage(
    envelope: KeyPackageEnvelope,
  ): Promise<void> {
    validateKeyPackage(envelope);

    this.#keyPackages.set(
      envelope.installationId,
      cloneKeyPackage(envelope),
    );
  }

  async fetchKeyPackages(
    installationIds: readonly InstallationId[],
  ): Promise<readonly KeyPackageEnvelope[]> {
    const result: KeyPackageEnvelope[] = [];

    for (const installationId of installationIds) {
      const envelope =
        this.#keyPackages.get(installationId);

      if (envelope) {
        result.push(
          cloneKeyPackage(envelope),
        );
      }
    }

    return result;
  }

  async publishHandshakes(
    deliveries: readonly MlsHandshakeDelivery[],
  ): Promise<void> {
    // Validate the entire batch first.
    // No relay state is mutated before this succeeds.
    validateHandshakeBatch(deliveries);

    const nextSequences =
      new Map(this.#handshakeSequence);

    const staged:
      Array<{
        recipient: InstallationId;
        envelope: MlsHandshakeEnvelope;
      }> = [];

    for (const delivery of deliveries) {
      const previous =
        nextSequences.get(
          delivery.recipientInstallationId,
        ) ?? 0n;

      const sequence = previous + 1n;

      nextSequences.set(
        delivery.recipientInstallationId,
        sequence,
      );

      staged.push({
        recipient:
          delivery.recipientInstallationId,

        envelope: {
          ...cloneHandshakeDelivery(delivery),
          id:
            `hs:${delivery.recipientInstallationId}:${sequence}`,
          sequence,
        },
      });
    }

    // Commit staged relay state only after the full batch is valid.
    for (const [installationId, sequence]
      of nextSequences) {
      this.#handshakeSequence.set(
        installationId,
        sequence,
      );
    }

    for (const item of staged) {
      const log =
        this.#handshakes.get(
          item.recipient,
        ) ?? [];

      log.push(item.envelope);

      this.#handshakes.set(
        item.recipient,
        log,
      );
    }
  }

  async fetchHandshakes(
    installationId: InstallationId,
    cursor?: string,
  ): Promise<{
    items: readonly MlsHandshakeEnvelope[];
    nextCursor?: string;
  }> {
    const after =
      parseCursor(cursor, "h");

    const log =
      this.#handshakes.get(
        installationId,
      ) ?? [];

    const items =
      log
        .filter(
          (item) =>
            item.sequence > after,
        )
        .map(cloneHandshakeEnvelope);

    const last = items.at(-1);

    return {
      items,
      ...(last
        ? {
            nextCursor:
              `h:${last.sequence}`,
          }
        : {}),
    };
  }

  async publishCiphertext(
    envelope: CiphertextEnvelope,
  ): Promise<void> {
    validateCiphertext(envelope);

    const log =
      this.#ciphertexts.get(
        envelope.conversationId,
      ) ?? [];

    if (
      log.some(
        (item) =>
          item.id === envelope.id,
      )
    ) {
      throw new Error(
        `Duplicate ciphertext ID: ${envelope.id}`,
      );
    }

    log.push(
      cloneCiphertext(envelope),
    );

    this.#ciphertexts.set(
      envelope.conversationId,
      log,
    );
  }

  async fetchCiphertexts(
    conversationId: string,
    cursor?: string,
  ): Promise<{
    items: readonly CiphertextEnvelope[];
    nextCursor?: string;
  }> {
    const offset =
      Number(
        parseCursor(cursor, "c"),
      );

    if (
      !Number.isSafeInteger(offset)
    ) {
      throw new Error(
        "Ciphertext cursor exceeds safe range",
      );
    }

    const log =
      this.#ciphertexts.get(
        conversationId,
      ) ?? [];

    const items =
      log
        .slice(offset)
        .map(cloneCiphertext);

    return {
      items,
      ...(items.length > 0
        ? {
            nextCursor:
              `c:${log.length}`,
          }
        : {}),
    };
  }
}

function validateKeyPackage(
  envelope: KeyPackageEnvelope,
): void {
  if (
    envelope.keyPackage.byteLength === 0
  ) {
    throw new Error(
      "MLS KeyPackage cannot be empty",
    );
  }

  if (
    envelope.expiresAt <=
    envelope.createdAt
  ) {
    throw new Error(
      "MLS KeyPackage expiry must be after creation",
    );
  }
}

function validateHandshakeBatch(
  deliveries:
    readonly MlsHandshakeDelivery[],
): void {
  const seen = new Set<string>();

  for (const delivery of deliveries) {
    if (
      delivery.payload.byteLength === 0
    ) {
      throw new Error(
        "MLS handshake payload cannot be empty",
      );
    }

    if (
      delivery.senderInstallationId ===
      delivery.recipientInstallationId
    ) {
      throw new Error(
        "MLS handshake cannot target the sender installation",
      );
    }

    const deliveryKey =
      `${delivery.kind}:${delivery.recipientInstallationId}`;

    if (seen.has(deliveryKey)) {
      throw new Error(
        `Duplicate MLS handshake delivery: ${deliveryKey}`,
      );
    }

    seen.add(deliveryKey);

    if (delivery.kind === "welcome") {
      if (
        delivery.context.metadata
          .conversationId !==
        delivery.conversationId
      ) {
        throw new Error(
          "MLS Welcome conversation mismatch",
        );
      }

      const recipientIncluded =
        delivery.context.members.some(
          (member) =>
            member.installationId ===
            delivery.recipientInstallationId,
        );

      if (!recipientIncluded) {
        throw new Error(
          "MLS Welcome recipient missing from group context",
        );
      }
    }
  }
}

function validateCiphertext(
  envelope: CiphertextEnvelope,
): void {
  if (
    envelope.payload.byteLength === 0
  ) {
    throw new Error(
      "MLS ciphertext cannot be empty",
    );
  }
}

function parseCursor(
  cursor: string | undefined,
  expectedPrefix: "h" | "c",
): bigint {
  if (!cursor) {
    return 0n;
  }

  const [
    prefix,
    value,
    extra,
  ] = cursor.split(":");

  if (
    prefix !== expectedPrefix ||
    value === undefined ||
    extra !== undefined ||
    !/^\d+$/.test(value)
  ) {
    throw new Error(
      `Invalid ${expectedPrefix} cursor`,
    );
  }

  return BigInt(value);
}

function cloneKeyPackage(
  envelope: KeyPackageEnvelope,
): KeyPackageEnvelope {
  return {
    ...envelope,
    keyPackage:
      new Uint8Array(
        envelope.keyPackage,
      ),
  };
}

function cloneCiphertext(
  envelope: CiphertextEnvelope,
): CiphertextEnvelope {
  return {
    ...envelope,
    payload:
      new Uint8Array(
        envelope.payload,
      ),
  };
}

function cloneHandshakeEnvelope(
  envelope: MlsHandshakeEnvelope,
): MlsHandshakeEnvelope {
  return {
    ...cloneHandshakeDelivery(
      envelope,
    ),
    id: envelope.id,
    sequence: envelope.sequence,
  };
}

function cloneHandshakeDelivery(
  delivery: MlsHandshakeDelivery,
): MlsHandshakeDelivery {
  if (delivery.kind === "commit") {
    return {
      ...delivery,
      payload:
        new Uint8Array(
          delivery.payload,
        ),
      change:
        cloneMembershipChange(
          delivery.change,
        ),
    };
  }

  return {
    ...delivery,
    payload:
      new Uint8Array(
        delivery.payload,
      ),
    context: {
      metadata: {
        ...delivery.context.metadata,
      },
      members:
        delivery.context.members.map(
          cloneMember,
        ),
    },
  };
}

function cloneMembershipChange(
  change: GroupMembershipChange,
): GroupMembershipChange {
  if (change.type === "remove") {
    return {
      ...change,
    };
  }

  return {
    type: "add",
    member:
      cloneMember(
        change.member,
      ),
  };
}

function cloneMember(
  member: GroupMember,
): GroupMember {
  return {
    ...member,
    credential:
      new Uint8Array(
        member.credential,
      ),
  };
}
