import type {
  MessagingTransport,
  MlsHandshakeEnvelope,
} from "../transport.js";

import type {
  MessagingIdentity,
} from "../types.js";

import type {
  OpenMlsBridge,
} from "./bridge.js";

interface SyncHandshakeInput {
  bridge: OpenMlsBridge;
  transport: MessagingTransport;
  identity: MessagingIdentity;
  cursor?: string;
}

export async function syncMlsHandshakes(
  input: SyncHandshakeInput,
): Promise<{
  processed: number;
  nextCursor?: string;
}> {
  const result =
    await input.transport
      .fetchHandshakes(
        input.identity
          .installationId,
        input.cursor,
      );

  // Validate the entire relay batch before changing MLS state.
  validateHandshakeBatch(
    result.items,
    input.identity
      .installationId,
  );

  if (
    result.items.length > 0 &&
    result.nextCursor ===
      undefined
  ) {
    throw new Error(
      "MLS handshake cursor missing for non-empty batch",
    );
  }

  for (
    const envelope
    of result.items
  ) {
    if (
      envelope.kind ===
      "welcome"
    ) {
      await input.bridge
        .joinFromWelcome({
          welcome:
            envelope.payload,
          conversationId:
            envelope
              .conversationId,
        });

      continue;
    }

    await input.bridge
      .processHandshake({
        conversationId:
          envelope
            .conversationId,
        message:
          envelope.payload,
      });
  }

  return {
    processed:
      result.items.length,
    ...(result.nextCursor
      ? {
          nextCursor:
            result.nextCursor,
        }
      : {}),
  };
}

function validateHandshakeBatch(
  items:
    readonly MlsHandshakeEnvelope[],
  installationId: string,
): void {
  let previousSequence:
    | bigint
    | undefined;

  for (
    const envelope
    of items
  ) {
    if (
      envelope
        .recipientInstallationId !==
      installationId
    ) {
      throw new Error(
        "MLS handshake recipient mismatch",
      );
    }

    if (
      previousSequence !==
        undefined &&
      envelope.sequence <=
        previousSequence
    ) {
      throw new Error(
        "MLS handshake sequence is not strictly increasing",
      );
    }

    previousSequence =
      envelope.sequence;
  }
}
