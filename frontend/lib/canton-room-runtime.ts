import initOpenMls, * as openMlsModule
  from "./openmls/vinss_mls.js";

import {
  HttpCantonLedgerClient,
} from "../../src/canton/http-ledger-client.js";

import {
  HttpCantonOfferProvider,
} from "../../src/canton/http-offer-provider.js";

import {
  isCantonDealTemplate,
} from "../../src/canton/deal-templates.js";

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


export type CantonRoomDealType =
  | "freelance"
  | "otc"
  | "goods"
  | "digital_goods"
  | "bounty"
  | "nft"
  | "other";

export interface CantonRoomOfferInput {
  dealType?: CantonRoomDealType;
  amount: string;
  instrumentId: string;
  terms: string;
  fields?: Readonly<
    Record<string, string>
  >;
  settlementRail?: string;
  expiresInHours?: number;
}

export interface CantonRoomOffer {
  dealId: string;
  contractId: string;
  sentAt: number;
  seller: string;
  buyer: string;
  amount: string;
  instrumentId: string;
  terms: string;
  dealType:
    CantonRoomDealType;
  fields: Readonly<
    Record<string, string>
  >;
  settlementRail: string;
  termsHash: string;
  expiresAt: string;
  own: boolean;
  status:
    | "pending"
    | "accepted"
    | "rejected";
  agreementContractId?: string;
}

export interface CantonRoomDealAction {
  dealId: string;
  action:
    | "accept"
    | "reject";
  sentAt: number;
  cantonContractId?: string;
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


  onOffers?(
    offers:
      readonly CantonRoomOffer[],
  ): void;

  onDealActions?(
    actions:
      readonly CantonRoomDealAction[],
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

    private readonly ledger:
      HttpCantonLedgerClient,

    private readonly offerProvider:
      HttpCantonOfferProvider,

    private readonly activeParty:
      string,
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
        ledger,
        new HttpCantonOfferProvider(
          ledger,
        ),
        directory.activeParty(),
      );

    await runtime
      .prepare();

    runtime.#subscription =
      await live.start({
        async onMessages(
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
                (message) =>
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

          const offers:
            CantonRoomOffer[] =
            [];

          const actions:
            CantonRoomDealAction[] =
            [];

          for (
            const message
            of messages
          ) {
            const offer =
              await toRoomOffer(
                message,
                installationId,
                directory
                  .activeParty(),
                input.peerParty,
              );

            if (offer) {
              offers.push(
                offer,
              );
            }

            const action =
              toRoomDealAction(
                message,
              );

            if (action) {
              actions.push(
                action,
              );
            }
          }

          if (
            offers.length >
            0
          ) {
            input.onOffers?.(
              offers,
            );
          }

          if (
            actions.length >
            0
          ) {
            input
              .onDealActions?.(
                actions,
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

  async createOffer(
    input:
      CantonRoomOfferInput,
  ): Promise<
    CantonRoomOffer
  > {
    const amount =
      input.amount.trim();

    const instrumentId =
      input.instrumentId
        .trim();

    const terms =
      input.terms.trim();

    const dealType =
      isCantonRoomDealType(
        input.dealType,
      )
        ? input.dealType
        : "other";

    const fields =
      cleanOfferFields(
        input.fields,
      );

    const settlementRail =
      input.settlementRail
        ?.trim() ||
      "canton";

    if (
      !/^\d+(?:\.\d+)?$/.test(
        amount,
      ) ||
      Number(amount) <= 0
    ) {
      throw new Error(
        "Offer amount must be greater than zero",
      );
    }

    if (!instrumentId) {
      throw new Error(
        "Offer instrument is required",
      );
    }

    if (!terms) {
      throw new Error(
        "Offer terms are required",
      );
    }

    const expiresInHours =
      Math.min(
        168,
        Math.max(
          1,
          Math.trunc(
            input
              .expiresInHours ??
              24,
          ),
        ),
      );

    const expiresAt =
      new Date(
        Date.now() +
          expiresInHours *
            60 *
            60 *
            1000,
      ).toISOString();

    const canonicalTerms =
      JSON.stringify({
        version: 2,
        dealType,
        settlementRail,
        amount,
        instrumentId,
        terms,
        fields,
        expiresAt,
      });

    const termsHash =
      await sha256Hex(
        canonicalTerms,
      );

    const dealId =
      crypto.randomUUID();

    const contractId =
      await this.offerProvider
        .createProposal(
          this.activeParty,
          {
            dealId,

            conversationId:
              this.input
                .conversationId,

            seller:
              this.activeParty,

            buyer:
              this.input
                .peerParty,

            termsHash,
            amount,
            instrumentId,
            expiresAt,
          },
        );

    const sentAt =
      Date.now();

    const message:
      PlainMessage = {
        id:
          crypto.randomUUID(),

        conversationId:
          this.input
            .conversationId,

        senderUserId:
          this.identity
            .userId,

        senderInstallationId:
          this.identity
            .installationId,

        sentAt,

        content: {
          type:
            "deal_proposal",

          dealId,
          canonicalTerms,
          termsHash,
          cantonContractId:
            contractId,
        },
      };

    await this.provider
      .send(message);

    return {
      dealId,
      contractId,
      sentAt,

      seller:
        this.activeParty,

      buyer:
        this.input
          .peerParty,

      amount,
      instrumentId,
      terms,
      dealType,
      fields,
      settlementRail,
      termsHash,
      expiresAt,

      own:
        true,

      status:
        "pending",
    };
  }

  async acceptOffer(
    offer:
      CantonRoomOffer,
  ): Promise<
    CantonRoomOffer
  > {
    if (offer.own) {
      throw new Error(
        "You cannot accept your own offer",
      );
    }

    await this
      .verifyOfferContract(
        offer,
      );

    const agreement =
      await this.offerProvider
        .acceptProposal(
          this.activeParty,
          offer.contractId,
        );

    await this
      .sendDealAction(
        offer.dealId,
        "accept",
        agreement.contractId,
      );

    return {
      ...offer,

      status:
        "accepted",

      agreementContractId:
        agreement.contractId,
    };
  }

  async rejectOffer(
    offer:
      CantonRoomOffer,
  ): Promise<
    CantonRoomOffer
  > {
    if (offer.own) {
      throw new Error(
        "You cannot reject your own offer",
      );
    }

    await this
      .verifyOfferContract(
        offer,
      );

    await this.offerProvider
      .rejectProposal(
        this.activeParty,
        offer.contractId,
      );

    await this
      .sendDealAction(
        offer.dealId,
        "reject",
      );

    return {
      ...offer,

      status:
        "rejected",
    };
  }

  private async sendDealAction(
    dealId: string,
    action:
      | "accept"
      | "reject",
    cantonContractId?:
      string,
  ): Promise<void> {
    const message:
      PlainMessage = {
        id:
          crypto.randomUUID(),

        conversationId:
          this.input
            .conversationId,

        senderUserId:
          this.identity
            .userId,

        senderInstallationId:
          this.identity
            .installationId,

        sentAt:
          Date.now(),

        content: {
          type:
            "deal_action",

          dealId,
          action,

          ...(cantonContractId
            ? {
                cantonContractId,
              }
            : {}),
        },
      };

    await this.provider
      .send(message);
  }

  private async verifyOfferContract(
    offer:
      CantonRoomOffer,
  ): Promise<void> {
    const contracts =
      await this.ledger
        .queryActiveContracts(
          this.activeParty,
        );

    const contract =
      contracts.find(
        (candidate) =>
          candidate
            .contractId ===
            offer
              .contractId &&
          isCantonDealTemplate(
            candidate
              .templateId,
            "DealProposal",
          ),
      );

    if (!contract) {
      throw new Error(
        "Canton offer is no longer active",
      );
    }

    const args =
      contract
        .createArgument;

    const expected = {
      dealId:
        offer.dealId,

      conversationId:
        this.input
          .conversationId,

      seller:
        offer.seller,

      buyer:
        offer.buyer,

      termsHash:
        offer.termsHash,

      amount:
        offer.amount,

      instrumentId:
        offer.instrumentId,

      expiresAt:
        offer.expiresAt,
    };

    for (
      const [
        key,
        value,
      ]
      of Object.entries(
        expected,
      )
    ) {
      if (
        readDealField(
          args,
          key,
        ) !==
        value
      ) {
        throw new Error(
          "Encrypted offer details do not match the Canton proposal",
        );
      }
    }
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

async function toRoomOffer(
  message:
    PlainMessage,

  localInstallationId:
    string,

  activeParty:
    string,

  peerParty:
    string,
):
  Promise<
    CantonRoomOffer |
    undefined
  > {
  if (
    message.content.type !==
      "deal_proposal"
  ) {
    return undefined;
  }

  const content =
    message.content;

  const actualHash =
    await sha256Hex(
      content.canonicalTerms,
    );

  if (
    actualHash !==
    content.termsHash
  ) {
    throw new Error(
      "Encrypted VINSS offer terms hash mismatch",
    );
  }

  const parsed =
    parseCanonicalTerms(
      content
        .canonicalTerms,
    );

  const own =
    message
      .senderInstallationId ===
    localInstallationId;

  return {
    dealId:
      content.dealId,

    contractId:
      content
        .cantonContractId,

    sentAt:
      message.sentAt,

    seller:
      own
        ? activeParty
        : peerParty,

    buyer:
      own
        ? peerParty
        : activeParty,

    amount:
      parsed.amount,

    instrumentId:
      parsed.instrumentId,

    terms:
      parsed.terms,

    dealType:
      parsed.dealType,

    fields:
      parsed.fields,

    settlementRail:
      parsed.settlementRail,

    termsHash:
      content.termsHash,

    expiresAt:
      parsed.expiresAt,

    own,

    status:
      "pending",
  };
}

function toRoomDealAction(
  message:
    PlainMessage,
):
  | CantonRoomDealAction
  | undefined {
  if (
    message.content.type !==
      "deal_action" ||
    (
      message.content.action !==
        "accept" &&
      message.content.action !==
        "reject"
    )
  ) {
    return undefined;
  }

  return {
    dealId:
      message
        .content
        .dealId,

    action:
      message
        .content
        .action,

    sentAt:
      message.sentAt,

    ...(message
      .content
      .cantonContractId
      ? {
          cantonContractId:
            message
              .content
              .cantonContractId,
        }
      : {}),
  };
}

function parseCanonicalTerms(
  value: string,
): {
  amount: string;
  instrumentId: string;
  terms: string;
  dealType:
    CantonRoomDealType;
  fields: Readonly<
    Record<string, string>
  >;
  settlementRail: string;
  expiresAt: string;
} {
  const parsed:
    unknown =
    JSON.parse(value);

  if (
    !isRecord(parsed) ||
    typeof parsed.amount !==
      "string" ||
    typeof parsed
      .instrumentId !==
      "string" ||
    typeof parsed.terms !==
      "string" ||
    typeof parsed.expiresAt !==
      "string"
  ) {
    throw new Error(
      "Invalid encrypted VINSS offer terms",
    );
  }

  return {
    amount:
      parsed.amount,

    instrumentId:
      parsed.instrumentId,

    terms:
      parsed.terms,

    dealType:
      isCantonRoomDealType(
        parsed.dealType,
      )
        ? parsed.dealType
        : "other",

    fields:
      readOfferFields(
        parsed.fields,
      ),

    settlementRail:
      typeof parsed
        .settlementRail ===
        "string" &&
      parsed
        .settlementRail
        .trim()
        ? parsed
            .settlementRail
            .trim()
        : "canton",

    expiresAt:
      parsed.expiresAt,
  };
}

function isCantonRoomDealType(
  value: unknown,
): value is CantonRoomDealType {
  return (
    value === "freelance" ||
    value === "otc" ||
    value === "goods" ||
    value ===
      "digital_goods" ||
    value === "bounty" ||
    value === "nft" ||
    value === "other"
  );
}

function cleanOfferFields(
  value:
    | Readonly<
        Record<
          string,
          string
        >
      >
    | undefined,
): Record<string, string> {
  if (!value) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(
        ([key, field]) => [
          key,
          field.trim(),
        ],
      )
      .filter(
        ([, field]) =>
          Boolean(field),
      ),
  );
}

function readOfferFields(
  value: unknown,
): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        (
          entry,
        ): entry is [
          string,
          string,
        ] =>
          typeof entry[1] ===
          "string",
      )
      .map(
        ([key, field]) => [
          key,
          field.trim(),
        ],
      )
      .filter(
        ([, field]) =>
          Boolean(field),
      ),
  );
}

async function sha256Hex(
  value: string,
): Promise<string> {
  const digest =
    new Uint8Array(
      await crypto.subtle
        .digest(
          "SHA-256",
          new TextEncoder()
            .encode(value),
        ),
    );

  return [
    ...digest,
  ]
    .map(
      (byte) =>
        byte
          .toString(16)
          .padStart(
            2,
            "0",
          ),
    )
    .join("");
}

function readDealField(
  value:
    Record<string, unknown>,
  key: string,
): string {
  const result =
    value[key];

  if (
    typeof result !==
      "string"
  ) {
    throw new Error(
      `Invalid Canton offer field: ${key}`,
    );
  }

  return result;
}

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(value)
  );
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
