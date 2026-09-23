import initOpenMls, * as openMlsModule
  from "./openmls/vinss_mls.js";

import {
  HttpCantonLedgerClient,
} from "../../src/canton/http-ledger-client.js";

import {
  CantonWebSocketUpdateStream,
} from "../../src/canton/websocket-update-stream.js";

import {
  AuthenticatedCantonMessagingDirectory,
} from "../../src/messaging/canton/authenticated-directory.js";

import {
  BrowserCantonLiveStateStore,
} from "../../src/messaging/canton/browser-live-state-store.js";

import {
  CantonLiveMessagingSession,
} from "../../src/messaging/canton/live-session.js";

import {
  CantonMessagingTransport,
} from "../../src/messaging/canton/transport.js";

import {
  BrowserOpenMlsBridge,
} from "../../src/messaging/openmls/browser-bridge.js";

import {
  IndexedDbOpenMlsCheckpointStore,
} from "../../src/messaging/openmls/indexeddb-checkpoint-store.js";

import {
  OpenMlsMessagingProvider,
} from "../../src/messaging/openmls/provider.js";

import type {
  OpenMlsWasmModule,
} from "../../src/messaging/openmls/wasm-api.js";

import type {
  CantonUpdateSubscription,
} from "../../src/canton/update-stream.js";

import type {
  PlainMessage,
} from "../../src/messaging/types.js";

export type CantonRoomStatus =
  | "connecting"
  | "waiting_peer"
  | "ready";

export interface CantonRoomMessage {
  id: string;
  senderUserId: string;
  senderInstallationId:
    string;
  sentAt: number;
  text: string;
  own: boolean;
}

export interface CantonRoomInput {
  conversationId: string;

  peerParty: string;

  peerInstallationId:
    string;

  creator: boolean;

  onStatus(
    status:
      CantonRoomStatus,
  ): void;

  onMessages(
    messages:
      readonly CantonRoomMessage[],
  ): void;

  onError(
    error: Error,
  ): void;
}

let wasm:
  | Promise<OpenMlsWasmModule>
  | undefined;

function loadOpenMls():
  Promise<OpenMlsWasmModule> {
  if (!wasm) {
    wasm =
      initOpenMls().then(
        () =>
          openMlsModule as unknown as
            OpenMlsWasmModule,
      );
  }

  return wasm;
}

export class CantonRoomRuntime {
  #subscription:
    | CantonUpdateSubscription
    | undefined;

  private constructor(
    private readonly input:
      CantonRoomInput,

    private readonly provider:
      OpenMlsMessagingProvider,

    private readonly bridge:
      BrowserOpenMlsBridge,

    private readonly identity: {
      userId: string;
      installationId: string;
      credential: Uint8Array;
    },

    private readonly peerMember: {
      userId: string;
      installationId: string;
      role: "member";
      credential: Uint8Array;
    },

    private readonly live:
      CantonLiveMessagingSession,
  ) {}

  static async connect(
    input:
      CantonRoomInput,
  ): Promise<
    CantonRoomRuntime
  > {
    input.onStatus(
      "connecting",
    );

    const baseUrl =
      process.env
        .NEXT_PUBLIC_CANTON_URL;

    if (!baseUrl) {
      throw new Error(
        "NEXT_PUBLIC_CANTON_URL is not configured",
      );
    }

    const userId =
      process.env
        .NEXT_PUBLIC_CANTON_USER_ID ??
      "ledger-api-user";

    const ledger =
      new HttpCantonLedgerClient({
        baseUrl,
        userId,
      });

    const authenticated =
      await ledger
        .getAuthenticatedIdentity();

    const installationId =
      installationFor(
        authenticated.userId,
      );

    const directory =
      await AuthenticatedCantonMessagingDirectory
        .connect(
          ledger,
          {
            localInstallationId:
              installationId,

            async resolvePartyForInstallation(
              candidate,
            ) {
              if (
                candidate ===
                input
                  .peerInstallationId
              ) {
                return input
                  .peerParty;
              }

              throw new Error(
                `Unknown VINSS installation: ${candidate}`,
              );
            },

            async recipientsForConversation(
              conversationId,
            ) {
              if (
                conversationId !==
                input.conversationId
              ) {
                throw new Error(
                  "Unknown VINSS conversation",
                );
              }

              return [
                input.peerParty,
              ];
            },

            async keyPackageReaders() {
              return [
                input.peerParty,
              ];
            },
          },
        );

    if (
      directory.activeParty() ===
      input.peerParty
    ) {
      throw new Error(
        "Peer Canton Party cannot equal the active Party",
      );
    }

    const checkpoint =
      new IndexedDbOpenMlsCheckpointStore();

    const bridge =
      new BrowserOpenMlsBridge(
        loadOpenMls,
        checkpoint,
      );

    const transport =
      new CantonMessagingTransport(
        ledger,
        directory,
      );

    const provider =
      new OpenMlsMessagingProvider(
        bridge,
        transport,
      );

    const encoder =
      new TextEncoder();

    const identity = {
      userId:
        authenticated.userId,

      installationId,

      credential:
        encoder.encode(
          directory.activeParty(),
        ),
    };

    await provider.initialize(
      identity,
    );

    const peerMember = {
      userId:
        input.peerParty,

      installationId:
        input
          .peerInstallationId,

      role:
        "member" as const,

      credential:
        encoder.encode(
          input.peerParty,
        ),
    };

    const live =
      new CantonLiveMessagingSession(
        provider,

        new CantonWebSocketUpdateStream({
          baseUrl,
        }),

        ledger,
        directory,
        installationId,

        new BrowserCantonLiveStateStore(
          window.localStorage,
        ),
      );

    const runtime =
      new CantonRoomRuntime(
        input,
        provider,
        bridge,
        identity,
        peerMember,
        live,
      );

    await runtime
      .prepare();

    runtime.#subscription =
      await live.start({
        onMessages(
          conversationId,
          messages,
        ) {
          if (
            conversationId !==
              input
                .conversationId
          ) {
            return;
          }

          const visible =
            messages
              .map(
                (
                  message,
                ) =>
                  toRoomMessage(
                    message,
                    installationId,
                  ),
              )
              .filter(
                (
                  message,
                ):
                  message is
                    CantonRoomMessage =>
                  message !==
                  undefined,
              );

          if (
            visible.length >
            0
          ) {
            input.onMessages(
              visible,
            );
          }
        },

        async onLedgerOffset() {
          await runtime
            .refreshStatus();
        },

        onError:
          input.onError,
      });

    await runtime
      .refreshStatus();

    return runtime;
  }

  async retryPeer():
    Promise<void> {
    if (
      !this.input.creator
    ) {
      return;
    }

    await this.prepare();
  }

  async sendText(
    text: string,
  ): Promise<
    CantonRoomMessage
  > {
    const clean =
      text.trim();

    if (!clean) {
      throw new Error(
        "Message is empty",
      );
    }

    await this.bridge
      .getGroupSnapshot(
        this.input
          .conversationId,
      );

    const message:
      PlainMessage = {
        id:
          crypto.randomUUID(),

        conversationId:
          this.input
            .conversationId,

        senderUserId:
          this.identity.userId,

        senderInstallationId:
          this.identity
            .installationId,

        sentAt:
          Date.now(),

        content: {
          type:
            "text",

          text:
            clean,
        },
      };

    await this.provider
      .send(message);

    return {
      id:
        message.id,

      senderUserId:
        message
          .senderUserId,

      senderInstallationId:
        message
          .senderInstallationId,

      sentAt:
        message.sentAt,

      text:
        clean,

      own:
        true,
    };
  }

  close(): void {
    this.#subscription
      ?.close();

    this.#subscription =
      undefined;
  }

  private async prepare():
    Promise<void> {
    if (
      !this.input.creator
    ) {
      await this
        .refreshStatus();

      return;
    }

    let snapshot;

    try {
      snapshot =
        await this.bridge
          .getGroupSnapshot(
            this.input
              .conversationId,
          );
    } catch (
      error
    ) {
      if (
        !isMissingGroup(
          error,
        )
      ) {
        throw error;
      }

      snapshot =
        await this.provider
          .createGroup({
            conversationId:
              this.input
                .conversationId,

            title:
              "VINSS Private Deal",

            creator: {
              ...this.identity,

              role:
                "super_admin",
            },
          });
    }

    if (
      snapshot.members.some(
        (member) =>
          member
            .installationId ===
          this.peerMember
            .installationId,
      )
    ) {
      this.input.onStatus(
        "ready",
      );

      return;
    }

    try {
      await this.provider
        .addMembers(
          this.input
            .conversationId,

          [
            this.peerMember,
          ],
        );

      this.input.onStatus(
        "ready",
      );
    } catch (
      error
    ) {
      if (
        isMissingKeyPackage(
          error,
        )
      ) {
        this.input.onStatus(
          "waiting_peer",
        );

        return;
      }

      throw error;
    }
  }

  private async refreshStatus():
    Promise<void> {
    try {
      await this.bridge
        .getGroupSnapshot(
          this.input
            .conversationId,
        );

      this.input.onStatus(
        "ready",
      );
    } catch (
      error
    ) {
      if (
        isMissingGroup(
          error,
        )
      ) {
        this.input.onStatus(
          "waiting_peer",
        );

        return;
      }

      throw error;
    }
  }
}

function installationFor(
  userId: string,
): string {
  const key =
    `vinss:installation:${userId}`;

  const existing =
    window.localStorage
      .getItem(key);

  if (existing) {
    return existing;
  }

  const created =
    crypto.randomUUID();

  window.localStorage
    .setItem(
      key,
      created,
    );

  return created;
}

function toRoomMessage(
  message:
    PlainMessage,

  localInstallationId:
    string,
):
  | CantonRoomMessage
  | undefined {
  if (
    message.content.type !==
      "text"
  ) {
    return undefined;
  }

  return {
    id:
      message.id,

    senderUserId:
      message.senderUserId,

    senderInstallationId:
      message
        .senderInstallationId,

    sentAt:
      message.sentAt,

    text:
      message.content.text,

    own:
      message
        .senderInstallationId ===
      localInstallationId,
  };
}

function isMissingGroup(
  value: unknown,
): boolean {
  return (
    value instanceof Error &&
    value.message.includes(
      "MLS group not found",
    )
  );
}

function isMissingKeyPackage(
  value: unknown,
): boolean {
  return (
    value instanceof Error &&
    value.message.includes(
      "Missing MLS KeyPackage",
    )
  );
}
