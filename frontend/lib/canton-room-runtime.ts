import { IndexedDbPlaintextStore } from "../../src/messaging/local/plaintext-store.js";
import { cantonNetwork } from "./workspace";
import { installationFor } from "./canton-invite";
import initOpenMls, * as openMlsModule from "./openmls/vinss_mls.js";

import type {
  CantonCreatedContract,
  CantonLedgerClient,
} from "../../src/canton/ledger-client.js";

import { CantonDappLedgerClient } from "./canton-dapp-ledger-client";

import { CantonPollingUpdateStream } from "./canton-polling-update-stream";

import { HttpCantonOfferProvider } from "../../src/canton/http-offer-provider.js";

import { StaticCantonRegistryDirectory } from "../../src/canton/registry-directory.js";

import { CantonTokenWallet } from "../../src/canton/token-wallet.js";
import { HttpCantonTokenRegistryClient } from "../../src/canton/token-registry-client.js";
import { selectedWalletKind } from "./canton-wallet-config";
import { devNetWallet, devNetRegistryFetch } from "./devnet-wallet";

import {
  isCantonDealTemplate,
  type CantonDealTemplateName,
} from "../../src/canton/deal-templates.js";

import { AuthenticatedCantonMessagingDirectory } from "../../src/messaging/canton/authenticated-directory.js";

import { BrowserCantonLiveStateStore } from "../../src/messaging/canton/browser-live-state-store.js";

import { CantonLiveMessagingSession } from "../../src/messaging/canton/live-session.js";

import { CantonMessagingTransport } from "../../src/messaging/canton/transport.js";

import { BrowserOpenMlsBridge } from "../../src/messaging/openmls/browser-bridge.js";

import { IndexedDbOpenMlsCheckpointStore } from "../../src/messaging/openmls/indexeddb-checkpoint-store.js";

import { OpenMlsMessagingProvider } from "../../src/messaging/openmls/provider.js";

import type { OpenMlsWasmModule } from "../../src/messaging/openmls/wasm-api.js";

import type { CantonUpdateSubscription } from "../../src/canton/update-stream.js";

import type { PlainMessage } from "../../src/messaging/types.js";

type CantonNetworkName = "devnet" | "testnet" | "mainnet";

interface CantonNetworkConfig {
  utilityBaseUrl: string;
  scanUrl: string;
  cbtcAdmin: string;
  usdcxAdmin?: string;
  ccAdmin?: string;
}

interface CantonAssetConfig {
  instrumentId: string;
  instrumentAdmin?: string;
}

const CANTON_NETWORKS: Record<CantonNetworkName, CantonNetworkConfig> = {
  devnet: {
    utilityBaseUrl: "https://api.utilities.digitalasset-dev.com",

    scanUrl: "https://scan.sv-1.dev.global.canton.network.sync.global",

    cbtcAdmin:
      "cbtc-network::12202a83c6f4082217c175e29bc53da5f2703ba2675778ab99217a5a881a949203ff",
  },

  testnet: {
    utilityBaseUrl: "https://api.utilities.digitalasset-staging.com",

    scanUrl: "https://scan.sv-1.test.global.canton.network.sync.global",

    cbtcAdmin:
      "cbtc-network::12201b1741b63e2494e4214cf0bedc3d5a224da53b3bf4d76dba468f8e97eb15508f",

    usdcxAdmin:
      "decentralized-usdc-interchain-rep::122049e2af8a725bd19759320fc83c638e7718973eac189d8f201309c512d1ffec61",

    ccAdmin:
      "DSO::1220f22a8b8f2d813c25b9a684dc4dd52b532a0174d8e73a13cdf2baabfff7518337",
  },

  mainnet: {
    utilityBaseUrl: "https://api.utilities.digitalasset.com",

    scanUrl: "https://scan.sv-1.global.canton.network.sync.global",

    cbtcAdmin:
      "cbtc-network::12205af3b949a04776fc48cdcc05a060f6bda2e470632935f375d1049a8546a3b262",

    usdcxAdmin:
      "decentralized-usdc-interchain-rep::12208115f1e168dd7e792320be9c4ca720c751a02a3053c7606e1c1cd3dad9bf60ef",
  },
};

function configuredCantonNetworkName(): CantonNetworkName {
  const value = (process.env.NEXT_PUBLIC_CANTON_NETWORK ?? "devnet")
    .trim()
    .toLowerCase();

  if (value !== "devnet" && value !== "testnet" && value !== "mainnet") {
    throw new Error(`Unsupported Canton network: ${value}`);
  }

  return value;
}

function configuredCantonNetwork(): CantonNetworkConfig {
  return CANTON_NETWORKS[configuredCantonNetworkName()];
}

function registrarRegistryUrl(
  utilityBaseUrl: string,
  registrarParty: string,
): string {
  return (
    `${utilityBaseUrl}` +
    `/api/token-standard/v0/registrars/` +
    `${encodeURIComponent(registrarParty)}`
  );
}

function configuredCcAdmin(): string | undefined {
  if (selectedWalletKind() === "devnet" && devNetWallet.ccAdmin()) return devNetWallet.ccAdmin();
  const value = process.env.NEXT_PUBLIC_CANTON_CC_ADMIN?.trim();

  if (value) {
    return value;
  }

  return configuredCantonNetwork().ccAdmin;
}

function configuredCantonRegistryEntries(): Record<string, string> {
  const network = configuredCantonNetwork();

  const entries: Record<string, string> = {
    [network.cbtcAdmin]: registrarRegistryUrl(
      network.utilityBaseUrl,
      network.cbtcAdmin,
    ),
  };

  if (network.usdcxAdmin) {
    entries[network.usdcxAdmin] = registrarRegistryUrl(
      network.utilityBaseUrl,
      network.usdcxAdmin,
    );
  }

  const ccAdmin = configuredCcAdmin();

  if (ccAdmin) {
    entries[ccAdmin] =
      (selectedWalletKind() === "devnet" ? "https://validator-api-http.validator.hackcanton-01.devnet.naas.noders.services/api/validator/v0/scan-proxy" : process.env.NEXT_PUBLIC_CANTON_CC_REGISTRY_URL?.trim()) ||
      `${network.scanUrl}/registry/`;
  }

  return entries;
}

function configuredCantonAsset(value: string): CantonAssetConfig {
  const clean = value.trim();

  const normalized = clean.toUpperCase().replace(/\s+/g, " ");

  const network = configuredCantonNetwork();

  if (normalized === "CBTC") {
    return {
      instrumentId: "CBTC",

      instrumentAdmin: network.cbtcAdmin,
    };
  }

  if (normalized === "USDC" || normalized === "USDCX") {
    if (!network.usdcxAdmin) {
      throw new Error(
        "USDCx is not configured for Canton DevNet; use TestNet or MainNet",
      );
    }

    return {
      instrumentId: "USDCx",

      instrumentAdmin: network.usdcxAdmin,
    };
  }

  if (
    normalized === "CC" ||
    normalized === "CANTON COIN" ||
    normalized === "AMULET"
  ) {
    const admin = configuredCcAdmin();

    if (!admin) {
      throw new Error(
        "Canton Coin requires NEXT_PUBLIC_CANTON_CC_ADMIN from the network DSO",
      );
    }

    return {
      instrumentId: "Amulet",

      instrumentAdmin: admin,
    };
  }

  return {
    instrumentId: clean,
  };
}

export type CantonRoomStatus = "connecting" | "waiting_peer" | "ready";

export interface CantonRoomMessage {
  id: string;
  senderUserId: string;
  senderInstallationId: string;
  sentAt: number;
  text: string;
  own: boolean;
}

export type CantonRoomDealType =
  "freelance" | "otc" | "goods" | "digital_goods" | "bounty" | "nft" | "other";

export interface CantonRoomOfferInput {
  dealType?: CantonRoomDealType;
  amount: string;
  instrumentId: string;
  terms: string;
  fields?: Readonly<Record<string, string>>;
  settlementRail?: string;
  expiresInHours?: number;
}

export type CantonRoomDealLifecycle =
  | "proposal"
  | "accepted"
  | "submitted"
  | "revision_requested"
  | "approved"
  | "settled";

export interface CantonRoomOffer {
  dealId: string;
  contractId: string;
  sentAt: number;
  seller: string;
  buyer: string;
  amount: string;
  instrumentId: string;
  instrumentAdmin?: string;
  terms: string;
  dealType: CantonRoomDealType;
  fields: Readonly<Record<string, string>>;
  settlementRail: string;
  termsHash: string;
  expiresAt: string;
  own: boolean;
  status: "pending" | "accepted" | "rejected";

  lifecycle?: CantonRoomDealLifecycle;

  agreementContractId?: string;
  allocationContractId?: string;
  escrowContractId?: string;
  fulfillmentContractId?: string;
  revisionRequestContractId?: string;
  approvalContractId?: string;
  settlementReceiptContractId?: string;
}

export interface CantonRoomDealAction {
  dealId: string;
  action:
    | "accept"
    | "reject"
    | "submit_fulfillment"
    | "request_revision"
    | "submit_revision"
    | "approve_fulfillment"
    | "settled";
  sentAt: number;
  cantonContractId?: string;
}

export interface CantonRoomInput {
  conversationId: string;

  walletParty: string;

  peerParty: string;

  peerInstallationId: string;
  bindingRequestId?: string;

  creator: boolean;

  onStatus(status: CantonRoomStatus): void;

  onProgress?(message: string): void;

  onMessages(messages: readonly CantonRoomMessage[]): void;

  onOffers?(offers: readonly CantonRoomOffer[]): void;

  onDealActions?(actions: readonly CantonRoomDealAction[]): void;

  onError(error: Error): void;
}

let wasm: Promise<OpenMlsWasmModule> | undefined;

export function loadOpenMls(): Promise<OpenMlsWasmModule> {
  if (!wasm) {
    wasm = initOpenMls().then(
      () => openMlsModule as unknown as OpenMlsWasmModule,
    );
  }

  return wasm;
}

export class CantonRoomRuntime {
  #subscription: CantonUpdateSubscription | undefined;
  #closed = false;
  #queue: Promise<unknown> = Promise.resolve();
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = this.#queue.then(work, work);
    this.#queue = next.catch(() => {});
    return next;
  }

  private constructor(
    private readonly input: CantonRoomInput,

    private readonly provider: OpenMlsMessagingProvider,

    private readonly bridge: BrowserOpenMlsBridge,

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

    private readonly live: CantonLiveMessagingSession,

    private readonly ledger: CantonLedgerClient,

    private readonly offerProvider: HttpCantonOfferProvider,

    private readonly tokenWallet: CantonTokenWallet,

    private readonly activeParty: string,
  ) {}

  static async connect(input: CantonRoomInput): Promise<CantonRoomRuntime> {
    input.onStatus("connecting");
    input.onProgress?.("Checking your Canton account…");

    const ledger = await CantonDappLedgerClient.connect(input.walletParty);

    const authenticated = await ledger.getAuthenticatedIdentity();

    const installationId = installationFor(authenticated.userId);

    const directory = await AuthenticatedCantonMessagingDirectory.connect(
      ledger,
      {
        localInstallationId: installationId,

        async resolvePartyForInstallation(candidate) {
          if (candidate === input.peerInstallationId) {
            return input.peerParty;
          }

          throw new Error(`Unknown VINSS installation: ${candidate}`);
        },

        async recipientsForConversation(conversationId) {
          if (conversationId !== input.conversationId) {
            throw new Error("Unknown VINSS conversation");
          }

          return [input.peerParty];
        },

        async keyPackageReaders() {
          return [input.peerParty];
        },
      },
    );

    if (directory.activeParty() === input.peerParty) {
      throw new Error("Peer Canton Party cannot equal the active Party");
    }

    const checkpoint = new IndexedDbOpenMlsCheckpointStore();

    const bridge = new BrowserOpenMlsBridge(loadOpenMls, checkpoint);

    const transport = new CantonMessagingTransport(
      ledger,
      directory,
      async (id) => {
        if (id === installationId) return directory.activeParty();
        if (id === input.peerInstallationId) return input.peerParty;
        throw new Error("Unknown private-room sender installation");
      },
      async () => {
        if (!input.bindingRequestId) return undefined;
        const requests = (
          await ledger.queryActiveContracts(directory.activeParty())
        )
          .filter(
            (c) =>
              c.templateId.endsWith(":Vinss.Messaging:KeyPackageRequest") &&
              c.createArgument.requestId === input.bindingRequestId &&
              ((c.createArgument.requester === directory.activeParty() &&
                c.createArgument.recipient === input.peerParty) ||
                (c.createArgument.requester === input.peerParty &&
                  c.createArgument.recipient === directory.activeParty())),
          )
          .sort((a, b) =>
            a.offset < b.offset ? -1 : a.offset > b.offset ? 1 : 0,
          );
        if (!requests[0])
          throw new Error("Room installation registration is missing");
        return requests[0].offset;
      },
    );

    const history = new IndexedDbPlaintextStore(
      JSON.stringify([
        cantonNetwork(),
        directory.activeParty(),
        installationId,
      ]),
    );
    const provider = new OpenMlsMessagingProvider(
      bridge,
      transport,
      undefined,
      {
        history,
        groupStateSender: input.creator
          ? installationId
          : input.peerInstallationId,
      },
    );

    const encoder = new TextEncoder();

    const identity = {
      userId: authenticated.userId,

      installationId,

      credential: encoder.encode(directory.activeParty()),
    };

    input.onProgress?.("Loading message encryption…");
    await loadOpenMls();
    input.onProgress?.("Preparing encryption keys. Review the approval requests that appear.");
    await provider.initialize(identity);

    const peerMember = {
      userId: `wallet:${input.peerParty}`,

      installationId: input.peerInstallationId,

      role: "member" as const,

      credential: encoder.encode(input.peerParty),
    };

    let synchronize = (id: string, cursor?: string) =>
      provider.sync(id, cursor);
    const live = new CantonLiveMessagingSession(
      {
        initialize: provider.initialize.bind(provider),
        createGroup: provider.createGroup.bind(provider),
        addMembers: provider.addMembers.bind(provider),
        removeMembers: provider.removeMembers.bind(provider),
        send: provider.send.bind(provider),
        sync: (id, cursor) => synchronize(id, cursor),
      },

      new CantonPollingUpdateStream({
        ledger,
      }),

      ledger,
      directory,
      installationId,

      new BrowserCantonLiveStateStore(
        window.localStorage,
        `vinss-canton:${cantonNetwork()}:${input.conversationId}`,
        "vinss-canton",
      ),
      (id) => id === input.conversationId,
    );

    const offerProvider = new HttpCantonOfferProvider(ledger);

    const tokenWallet = new CantonTokenWallet({
      ledger,

      dealProvider: offerProvider,

      registryDirectory: new StaticCantonRegistryDirectory(
        configuredCantonRegistryEntries(),
      ),
      ...(selectedWalletKind() === "devnet" ? { registryClientFactory: (baseUrl: string) => new HttpCantonTokenRegistryClient({ baseUrl, fetcher: devNetRegistryFetch }) } : {}),
    });

    const runtime = new CantonRoomRuntime(
      input,
      provider,
      bridge,
      identity,
      peerMember,
      live,
      ledger,
      offerProvider,
      tokenWallet,
      directory.activeParty(),
    );

    synchronize = (id, cursor) =>
      runtime.serialize(() => provider.sync(id, cursor));
    input.onProgress?.(input.creator
      ? "Establishing the encrypted room. Approve its handshake requests."
      : "Waiting for the creator’s encrypted welcome…");
    await runtime.serialize(() => runtime.prepare());

    const deliveredMessageIds = new Set<string>();
    const consume = async (
      conversationId: string,
      messages: readonly PlainMessage[],
    ) => {
      if (runtime.#closed || conversationId !== input.conversationId) {
        return;
      }

      const visible = messages
        .map((message) => toRoomMessage(message, installationId))
        .filter(
          (message): message is CantonRoomMessage => message !== undefined,
        )
        .filter((message) => !deliveredMessageIds.has(message.id));

      if (visible.length > 0) {
        input.onMessages(visible);
        for (const message of visible) deliveredMessageIds.add(message.id);
      }

      const offers: CantonRoomOffer[] = [];

      const actions: CantonRoomDealAction[] = [];

      for (const message of messages) {
        const offer = await toRoomOffer(
          message,
          installationId,
          directory.activeParty(),
          input.peerParty,
        );

        if (offer) {
          offers.push(offer);
        }

        const action = toRoomDealAction(message);

        if (action) {
          actions.push(action);
        }
      }

      if (offers.length > 0) {
        const hydrated = await hydrateOffers(offers, ledger, directory.activeParty());
        if (!runtime.#closed) input.onOffers?.(hydrated);
      }

      if (!runtime.#closed && actions.length > 0) {
        input.onDealActions?.(actions);
      }
    };
    await consume(
      input.conversationId,
      await history.list(input.conversationId),
    );
    input.onProgress?.("Synchronizing the encrypted conversation with Canton…");
    runtime.#subscription = await live.start({
      onMessages: consume,
      async onLedgerOffset() {
        if (runtime.#closed) return;
        if (input.creator) await runtime.serialize(() => runtime.prepare());
        else await runtime.refreshStatus();

        // Re-read encrypted history after a ledger update so a reload or the
        // other participant's browser reflects the Canton contracts that are
        // actually active, including funding and settlement.
        await consume(
          input.conversationId,
          await history.list(input.conversationId),
        );
      },

      onError(error) {
        if (!runtime.#closed) input.onError(error);
      },
    });

    await runtime.refreshStatus();

    return runtime;
  }

  async retryPeer(): Promise<void> {
    if (!this.input.creator) {
      return;
    }

    await this.serialize(() => this.prepare());
  }

  async sendText(text: string): Promise<CantonRoomMessage> {
    const clean = text.trim();

    if (!clean) {
      throw new Error("Message is empty");
    }

    await this.bridge.getGroupSnapshot(this.input.conversationId);

    const message: PlainMessage = {
      id: crypto.randomUUID(),

      conversationId: this.input.conversationId,

      senderUserId: this.identity.userId,

      senderInstallationId: this.identity.installationId,

      sentAt: Date.now(),

      content: {
        type: "text",

        text: clean,
      },
    };

    await this.serialize(() => this.provider.send(message));

    return {
      id: message.id,

      senderUserId: message.senderUserId,

      senderInstallationId: message.senderInstallationId,

      sentAt: message.sentAt,

      text: clean,

      own: true,
    };
  }

  async createOffer(input: CantonRoomOfferInput): Promise<CantonRoomOffer> {
    const amount = input.amount.trim();

    const asset = configuredCantonAsset(input.instrumentId);

    const instrumentId = asset.instrumentId;

    const terms = input.terms.trim();

    const dealType = isCantonRoomDealType(input.dealType)
      ? input.dealType
      : "other";

    const fields = cleanOfferFields(input.fields);

    const settlementRail = input.settlementRail?.trim() || "canton";

    const instrumentAdmin =
      settlementRail === "canton" ? asset.instrumentAdmin : undefined;

    if (!/^\d+(?:\.\d+)?$/.test(amount) || Number(amount) <= 0) {
      throw new Error("Offer amount must be greater than zero");
    }

    if (!instrumentId) {
      throw new Error("Offer instrument is required");
    }

    if (!terms) {
      throw new Error("Offer terms are required");
    }

    const expiresInHours = Math.min(
      168,
      Math.max(1, Math.trunc(input.expiresInHours ?? 24)),
    );

    const expiresAt = new Date(
      Date.now() + expiresInHours * 60 * 60 * 1000,
    ).toISOString();

    const canonicalTerms = JSON.stringify({
      version: 3,
      dealType,
      settlementRail,
      amount,
      instrumentId,

      instrumentAdmin: instrumentAdmin ?? null,

      terms,
      fields,
      expiresAt,
    });

    const termsHash = await sha256Hex(canonicalTerms);

    const dealId = crypto.randomUUID();

    const contractId = await this.offerProvider.createProposal(
      this.activeParty,
      {
        dealId,

        conversationId: this.input.conversationId,

        seller: this.activeParty,

        buyer: this.input.peerParty,

        termsHash,
        amount,
        instrumentId,

        ...(instrumentAdmin ? { instrumentAdmin } : {}),

        expiresAt,
      },
    );

    const sentAt = Date.now();

    const message: PlainMessage = {
      id: crypto.randomUUID(),

      conversationId: this.input.conversationId,

      senderUserId: this.identity.userId,

      senderInstallationId: this.identity.installationId,

      sentAt,

      content: {
        type: "deal_proposal",

        dealId,
        canonicalTerms,
        termsHash,
        cantonContractId: contractId,
      },
    };

    await this.serialize(() => this.provider.send(message));

    return {
      dealId,
      contractId,
      sentAt,

      seller: this.activeParty,

      buyer: this.input.peerParty,

      amount,
      instrumentId,

      ...(instrumentAdmin ? { instrumentAdmin } : {}),

      terms,
      dealType,
      fields,
      settlementRail,
      termsHash,
      expiresAt,

      own: true,

      status: "pending",

      lifecycle: "proposal",
    };
  }

  async acceptOffer(offer: CantonRoomOffer): Promise<CantonRoomOffer> {
    if (offer.own) {
      throw new Error("You cannot accept your own offer");
    }

    // Acceptance consumes the proposal. A retry must use the live agreement.
    const existing = await this.offerProvider.findActiveAgreement(this.activeParty, offer.dealId);
    if (existing) {
      const expected = { dealId: offer.dealId, conversationId: this.input.conversationId,
        seller: offer.seller, buyer: offer.buyer, termsHash: offer.termsHash,
        amount: offer.amount, instrumentId: offer.instrumentId, expiresAt: offer.expiresAt,
        instrumentAdmin: offer.instrumentAdmin };
      for (const [key, value] of Object.entries(expected))
        if (existing.terms[key as keyof typeof existing.terms] !== value)
          throw new Error("The live agreement does not match this offer.");
    }
    if (!existing) await this.verifyOfferContract(offer);
    const agreement = existing ?? await this.offerProvider.acceptProposal(this.activeParty, offer.contractId);

    let allocationContractId: string | undefined;

    let escrowContractId: string | undefined;

    if (agreement.terms.instrumentAdmin) {
      const funded = await this.tokenWallet.allocateAndFundEscrow(
        this.activeParty,
        agreement,
      );

      allocationContractId = funded.allocationContractId;

      escrowContractId = funded.escrowContractId;
    }

    await this.sendDealAction(offer.dealId, "accept", agreement.contractId);

    return {
      ...offer,

      status: "accepted",

      lifecycle: "accepted",

      agreementContractId: agreement.contractId,

      ...(allocationContractId ? { allocationContractId } : {}),

      ...(escrowContractId ? { escrowContractId } : {}),
    };
  }

  async rejectOffer(offer: CantonRoomOffer): Promise<CantonRoomOffer> {
    if (offer.own) {
      throw new Error("You cannot reject your own offer");
    }

    await this.verifyOfferContract(offer);

    await this.offerProvider.rejectProposal(this.activeParty, offer.contractId);

    await this.sendDealAction(offer.dealId, "reject");

    return {
      ...offer,

      status: "rejected",
    };
  }

  async submitFulfillment(
    offer: CantonRoomOffer,

    proof: string,
  ): Promise<CantonRoomOffer> {
    if (!offer.own) {
      throw new Error("Only the fulfiller can submit fulfillment");
    }

    const clean = proof.trim();

    if (!clean) {
      throw new Error("Fulfillment proof is required");
    }

    const source = await this.findDealContract(offer.dealId, [
      "DealEscrow",
      "DealAgreement",
    ]);

    const fulfillmentContractId = await this.offerProvider.submitFulfillment(
      this.activeParty,
      source.contractId,
      await sha256Hex(clean),
    );

    await this.sendDealAction(
      offer.dealId,
      "submit_fulfillment",
      fulfillmentContractId,
    );

    await this.sendText(`[Fulfillment submitted]\n${clean}`);

    return {
      ...offer,
      status: "accepted",
      lifecycle: "submitted",
      fulfillmentContractId,
    };
  }

  async requestRevision(
    offer: CantonRoomOffer,

    note: string,
  ): Promise<CantonRoomOffer> {
    if (offer.own) {
      throw new Error("Only the reviewer can request a revision");
    }

    const clean = note.trim();

    if (!clean) {
      throw new Error("Revision note is required");
    }

    const fulfillment = await this.findDealContract(offer.dealId, [
      "DealFulfillment",
    ]);

    const revisionRequestContractId = await this.offerProvider.requestRevision(
      this.activeParty,
      fulfillment.contractId,
      await sha256Hex(clean),
    );

    await this.sendDealAction(
      offer.dealId,
      "request_revision",
      revisionRequestContractId,
    );

    await this.sendText(`[Revision requested]\n${clean}`);

    return {
      ...offer,
      status: "accepted",
      lifecycle: "revision_requested",
      revisionRequestContractId,
    };
  }

  async submitRevision(
    offer: CantonRoomOffer,

    proof: string,
  ): Promise<CantonRoomOffer> {
    if (!offer.own) {
      throw new Error("Only the fulfiller can submit a revision");
    }

    const clean = proof.trim();

    if (!clean) {
      throw new Error("Revision proof is required");
    }

    const revision = await this.findDealContract(offer.dealId, [
      "DealRevisionRequest",
    ]);

    const fulfillmentContractId = await this.offerProvider.submitRevision(
      this.activeParty,
      revision.contractId,
      await sha256Hex(clean),
    );

    await this.sendDealAction(
      offer.dealId,
      "submit_revision",
      fulfillmentContractId,
    );

    await this.sendText(`[Revision submitted]\n${clean}`);

    return {
      ...offer,
      status: "accepted",
      lifecycle: "submitted",
      fulfillmentContractId,
    };
  }

  async approveFulfillment(offer: CantonRoomOffer): Promise<CantonRoomOffer> {
    if (offer.own) {
      throw new Error("Only the reviewer can approve fulfillment");
    }

    const fulfillment = await this.findDealContract(offer.dealId, [
      "DealFulfillment",
    ]);

    const approvalContractId = await this.offerProvider.approveFulfillment(
      this.activeParty,
      fulfillment.contractId,
    );

    await this.sendDealAction(
      offer.dealId,
      "approve_fulfillment",
      approvalContractId,
    );

    return {
      ...offer,
      status: "accepted",
      lifecycle: "approved",
      approvalContractId,
    };
  }

  async settleOffer(offer: CantonRoomOffer): Promise<CantonRoomOffer> {
    if (!offer.own) {
      throw new Error("Only the fulfiller can settle the escrow");
    }

    if (!offer.instrumentAdmin) {
      throw new Error("This deal has no Canton Token Standard escrow");
    }

    const approval = await this.findDealContract(offer.dealId, [
      "FulfillmentApproval",
    ]);

    const receipt = await this.tokenWallet.settleWithRegistry(
      this.activeParty,
      approval.contractId,
    );

    await this.sendDealAction(
      offer.dealId,
      "settled",
      receipt.receiptContractId,
    );

    return {
      ...offer,
      status: "accepted",
      lifecycle: "settled",
      approvalContractId: approval.contractId,
      settlementReceiptContractId: receipt.receiptContractId,
    };
  }

  private async findDealContract(
    dealId: string,

    templateNames: readonly CantonDealTemplateName[],
  ) {
    const contracts = await this.ledger.queryActiveContracts(this.activeParty);

    for (const templateName of templateNames) {
      const contract = contracts
        .filter(
          (candidate) =>
            isCantonDealTemplate(candidate.templateId, templateName) &&
            readDealField(candidate.createArgument, "dealId") === dealId,
        )
        .at(-1);

      if (contract) {
        return contract;
      }
    }

    throw new Error(`VINSS active deal contract not found for ${dealId}`);
  }

  private async sendDealAction(
    dealId: string,
    action:
      | "accept"
      | "reject"
      | "submit_fulfillment"
      | "request_revision"
      | "submit_revision"
      | "approve_fulfillment"
      | "settled",
    cantonContractId?: string,
  ): Promise<void> {
    const message: PlainMessage = {
      id: crypto.randomUUID(),

      conversationId: this.input.conversationId,

      senderUserId: this.identity.userId,

      senderInstallationId: this.identity.installationId,

      sentAt: Date.now(),

      content: {
        type: "deal_action",

        dealId,
        action,

        ...(cantonContractId
          ? {
              cantonContractId,
            }
          : {}),
      },
    };

    await this.serialize(() => this.provider.send(message));
  }

  private async verifyOfferContract(offer: CantonRoomOffer): Promise<void> {
    const contracts = await this.ledger.queryActiveContracts(this.activeParty);

    const contract = contracts.find(
      (candidate) =>
        candidate.contractId === offer.contractId &&
        isCantonDealTemplate(candidate.templateId, "DealProposal"),
    );

    if (!contract) {
      throw new Error("Canton offer is no longer active");
    }

    const args = contract.createArgument;

    const expected = {
      dealId: offer.dealId,

      conversationId: this.input.conversationId,

      seller: offer.seller,

      buyer: offer.buyer,

      termsHash: offer.termsHash,

      amount: offer.amount,

      instrumentId: offer.instrumentId,

      expiresAt: offer.expiresAt,
    };

    for (const [key, value] of Object.entries(expected)) {
      if (readDealField(args, key) !== value) {
        throw new Error(
          "Encrypted offer details do not match the Canton proposal",
        );
      }
    }

    if (
      readOptionalDealField(args, "instrumentAdmin") !== offer.instrumentAdmin
    ) {
      throw new Error(
        "Canton instrument registry does not match the encrypted offer",
      );
    }
  }

  close(): void {
    this.#closed = true;
    this.#subscription?.close();

    this.#subscription = undefined;
  }

  private async prepare(): Promise<void> {
    if (!this.input.creator) {
      await this.refreshStatus();

      return;
    }

    let snapshot;

    try {
      snapshot = await this.bridge.getGroupSnapshot(this.input.conversationId);
    } catch (error) {
      if (!isMissingGroup(error)) {
        throw error;
      }

      snapshot = await this.provider.createGroup({
        conversationId: this.input.conversationId,

        title: "VINSS Private Deal",

        creator: {
          ...this.identity,

          role: "super_admin",
        },
      });
    }

    if (
      snapshot.members.some(
        (member) =>
          member.installationId !== this.identity.installationId &&
          member.installationId !== this.peerMember.installationId,
      )
    ) {
      throw new Error(
        "This private room is already bound to a different participant.",
      );
    }

    if (
      snapshot.members.some(
        (member) => member.installationId === this.peerMember.installationId,
      )
    ) {
      this.input.onStatus("ready");

      return;
    }

    try {
      await this.provider.addMembers(
        this.input.conversationId,

        [this.peerMember],
      );

      this.input.onStatus("ready");
    } catch (error) {
      if (isMissingKeyPackage(error)) {
        this.input.onStatus("waiting_peer");

        return;
      }

      throw error;
    }
  }

  private async refreshStatus(): Promise<void> {
    try {
      const snapshot = await this.bridge.getGroupSnapshot(
        this.input.conversationId,
      );
      this.input.onStatus(
        snapshot.members.some(
          (member) => member.installationId === this.peerMember.installationId,
        )
          ? "ready"
          : "waiting_peer",
      );
    } catch (error) {
      if (isMissingGroup(error)) {
        this.input.onStatus("waiting_peer");

        return;
      }

      throw error;
    }
  }
}

function toRoomMessage(
  message: PlainMessage,

  localInstallationId: string,
): CantonRoomMessage | undefined {
  if (message.content.type !== "text") {
    return undefined;
  }

  return {
    id: message.id,

    senderUserId: message.senderUserId,

    senderInstallationId: message.senderInstallationId,

    sentAt: message.sentAt,

    text: message.content.text,

    own: message.senderInstallationId === localInstallationId,
  };
}

async function hydrateOffers(
  offers: readonly CantonRoomOffer[],
  ledger: CantonLedgerClient,
  activeParty: string,
): Promise<CantonRoomOffer[]> {
  const contracts = await ledger.queryActiveContracts(activeParty);

  return offers.map((offer) => hydrateOffer(offer, contracts));
}

function hydrateOffer(
  offer: CantonRoomOffer,
  contracts: readonly CantonCreatedContract[],
): CantonRoomOffer {
  if (offer.status === "rejected") {
    return offer;
  }

  const dealContracts = contracts.filter(
    (contract) =>
      isCantonDealContract(contract, "DealAgreement", offer.dealId) ||
      isCantonDealContract(contract, "DealEscrow", offer.dealId) ||
      isCantonDealContract(contract, "DealFulfillment", offer.dealId) ||
      isCantonDealContract(contract, "DealRevisionRequest", offer.dealId) ||
      isCantonDealContract(contract, "FulfillmentApproval", offer.dealId) ||
      isCantonDealContract(contract, "SettlementReceipt", offer.dealId),
  );

  const agreement = latestDealContract(
    dealContracts,
    "DealAgreement",
  );
  const escrow = latestDealContract(dealContracts, "DealEscrow");
  const fulfillment = latestDealContract(dealContracts, "DealFulfillment");
  const revision = latestDealContract(dealContracts, "DealRevisionRequest");
  const approval = latestDealContract(dealContracts, "FulfillmentApproval");
  const receipt = latestDealContract(dealContracts, "SettlementReceipt");
  const allocationContractId =
    readOptionalDealField(
      escrow?.createArgument ?? {},
      "lockedAllocationCid",
    ) ??
    readOptionalDealField(
      approval?.createArgument ?? {},
      "lockedAllocationCid",
    ) ??
    readOptionalDealField(
      fulfillment?.createArgument ?? {},
      "lockedAllocationCid",
    );

  const lifecycle = receipt
    ? "settled"
    : approval
      ? "approved"
      : revision
        ? "revision_requested"
        : fulfillment
          ? "submitted"
          : escrow || agreement
            ? "accepted"
            : offer.lifecycle;

  return {
    ...offer,
    ...(lifecycle ? { lifecycle } : {}),
    ...(lifecycle && lifecycle !== "proposal" ? { status: "accepted" } : {}),
    ...(agreement
      ? { agreementContractId: agreement.contractId }
      : {}),
    ...(escrow
      ? { escrowContractId: escrow.contractId }
      : {}),
    ...(allocationContractId ? { allocationContractId } : {}),
    ...(fulfillment
      ? { fulfillmentContractId: fulfillment.contractId }
      : {}),
    ...(revision
      ? { revisionRequestContractId: revision.contractId }
      : {}),
    ...(approval
      ? { approvalContractId: approval.contractId }
      : {}),
    ...(receipt
      ? { settlementReceiptContractId: receipt.contractId }
      : {}),
  };
}

function latestDealContract(
  contracts: readonly CantonCreatedContract[],
  templateName: CantonDealTemplateName,
): CantonCreatedContract | undefined {
  return contracts
    .filter((contract) =>
      isCantonDealTemplate(contract.templateId, templateName),
    )
    .sort((left, right) =>
      left.offset < right.offset ? -1 : left.offset > right.offset ? 1 : 0,
    )
    .at(-1);
}

function isCantonDealContract(
  contract: CantonCreatedContract,
  templateName: CantonDealTemplateName,
  dealId: string,
): boolean {
  return (
    isCantonDealTemplate(contract.templateId, templateName) &&
    readOptionalDealField(contract.createArgument, "dealId") === dealId
  );
}

async function toRoomOffer(
  message: PlainMessage,

  localInstallationId: string,

  activeParty: string,

  peerParty: string,
): Promise<CantonRoomOffer | undefined> {
  if (message.content.type !== "deal_proposal") {
    return undefined;
  }

  const content = message.content;

  const actualHash = await sha256Hex(content.canonicalTerms);

  if (actualHash !== content.termsHash) {
    throw new Error("Encrypted VINSS offer terms hash mismatch");
  }

  const parsed = parseCanonicalTerms(content.canonicalTerms);

  const own = message.senderInstallationId === localInstallationId;

  const instrumentAdmin = parsed.instrumentAdmin;

  return {
    dealId: content.dealId,

    contractId: content.cantonContractId,

    sentAt: message.sentAt,

    seller: own ? activeParty : peerParty,

    buyer: own ? peerParty : activeParty,

    amount: parsed.amount,

    instrumentId: parsed.instrumentId,

    ...(instrumentAdmin ? { instrumentAdmin } : {}),

    terms: parsed.terms,

    dealType: parsed.dealType,

    fields: parsed.fields,

    settlementRail: parsed.settlementRail,

    termsHash: content.termsHash,

    expiresAt: parsed.expiresAt,

    own,

    status: "pending",

    lifecycle: "proposal",
  };
}

function toRoomDealAction(
  message: PlainMessage,
): CantonRoomDealAction | undefined {
  if (
    message.content.type !== "deal_action" ||
    !isCantonRoomDealAction(message.content.action)
  ) {
    return undefined;
  }

  return {
    dealId: message.content.dealId,

    action: message.content.action,

    sentAt: message.sentAt,

    ...(message.content.cantonContractId
      ? {
          cantonContractId: message.content.cantonContractId,
        }
      : {}),
  };
}

function isCantonRoomDealAction(
  value: unknown,
): value is CantonRoomDealAction["action"] {
  return (
    value === "accept" ||
    value === "reject" ||
    value === "submit_fulfillment" ||
    value === "request_revision" ||
    value === "submit_revision" ||
    value === "approve_fulfillment" ||
    value === "settled"
  );
}

function parseCanonicalTerms(value: string): {
  amount: string;
  instrumentId: string;
  instrumentAdmin?: string;
  terms: string;
  dealType: CantonRoomDealType;
  fields: Readonly<Record<string, string>>;
  settlementRail: string;
  expiresAt: string;
} {
  const parsed: unknown = JSON.parse(value);

  if (
    !isRecord(parsed) ||
    typeof parsed.amount !== "string" ||
    typeof parsed.instrumentId !== "string" ||
    typeof parsed.terms !== "string" ||
    typeof parsed.expiresAt !== "string"
  ) {
    throw new Error("Invalid encrypted VINSS offer terms");
  }

  return {
    amount: parsed.amount,

    instrumentId: parsed.instrumentId,

    ...(typeof parsed.instrumentAdmin === "string" &&
    parsed.instrumentAdmin.trim()
      ? {
          instrumentAdmin: parsed.instrumentAdmin.trim(),
        }
      : {}),

    terms: parsed.terms,

    dealType: isCantonRoomDealType(parsed.dealType) ? parsed.dealType : "other",

    fields: readOfferFields(parsed.fields),

    settlementRail:
      typeof parsed.settlementRail === "string" && parsed.settlementRail.trim()
        ? parsed.settlementRail.trim()
        : "canton",

    expiresAt: parsed.expiresAt,
  };
}

function isCantonRoomDealType(value: unknown): value is CantonRoomDealType {
  return (
    value === "freelance" ||
    value === "otc" ||
    value === "goods" ||
    value === "digital_goods" ||
    value === "bounty" ||
    value === "nft" ||
    value === "other"
  );
}

function cleanOfferFields(
  value: Readonly<Record<string, string>> | undefined,
): Record<string, string> {
  if (!value) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, field]) => [key, field.trim()])
      .filter(([, field]) => Boolean(field)),
  );
}

function readOfferFields(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      )
      .map(([key, field]) => [key, field.trim()])
      .filter(([, field]) => Boolean(field)),
  );
}

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );

  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readOptionalDealField(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  const result = value[key];

  return typeof result === "string" ? result : undefined;
}

function readDealField(value: Record<string, unknown>, key: string): string {
  const result = value[key];

  if (typeof result !== "string") {
    throw new Error(`Invalid Canton offer field: ${key}`);
  }

  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingGroup(value: unknown): boolean {
  return (
    value instanceof Error && value.message.includes("MLS group not found")
  );
}

function isMissingKeyPackage(value: unknown): boolean {
  return (
    value instanceof Error && value.message.includes("Missing MLS KeyPackage")
  );
}
