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
    await input.transport.fetchHandshakes(
      input.identity.installationId,
      input.cursor,
    );

  // Validate the complete relay batch before mutating MLS state.
  validateHandshakeBatch(
    result.items,
    input.identity.installationId,
  );

  if (
    result.items.length > 0 &&
    result.nextCursor === undefined
  ) {
    throw new Error(
      "MLS handshake cursor missing for non-empty batch",
    );
  }

  for (const envelope of result.items) {
    await processHandshakeEnvelope(
      input.bridge,
      envelope,
    );
  }

  return {
    processed: result.items.length,
    ...(result.nextCursor
      ? {
          nextCursor:
            result.nextCursor,
        }
      : {}),
  };
}

function validateHandshakeBatch(
  items: readonly MlsHandshakeEnvelope[],
  installationId: string,
): void {
  let previousSequence:
    | bigint
    | undefined;

  for (const envelope of items) {
    if (
      envelope.recipientInstallationId !==
      installationId
    ) {
      throw new Error(
        "MLS handshake recipient mismatch",
      );
    }

    if (
      previousSequence !== undefined &&
      envelope.sequence <= previousSequence
    ) {
      throw new Error(
        "MLS handshake sequence is not strictly increasing",
      );
    }

    previousSequence =
      envelope.sequence;
  }
}

async function processHandshakeEnvelope(
  bridge: OpenMlsBridge,
  envelope: MlsHandshakeEnvelope,
): Promise<void> {
  if (envelope.kind === "welcome") {
    if (
      envelope.context.metadata
        .conversationId !==
      envelope.conversationId
    ) {
      throw new Error(
        "MLS Welcome conversation mismatch",
      );
    }

    await bridge.joinFromWelcome({
      welcome: envelope.payload,
      metadata:
        envelope.context.metadata,
      members:
        envelope.context.members,
    });

    return;
  }

  await bridge.processHandshake({
    conversationId:
      envelope.conversationId,
    message: envelope.payload,
    change: envelope.change,
  });
}
