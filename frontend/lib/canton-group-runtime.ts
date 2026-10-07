import type {
  GroupMember,
  GroupSnapshot,
  PlainMessage,
} from "../../src/messaging/types.js";
import { BrowserOpenMlsBridge } from "../../src/messaging/openmls/browser-bridge.js";
import { IndexedDbOpenMlsCheckpointStore } from "../../src/messaging/openmls/indexeddb-checkpoint-store.js";
import { OpenMlsMessagingProvider } from "../../src/messaging/openmls/provider.js";
import { IndexedDbPlaintextStore } from "../../src/messaging/local/plaintext-store.js";
import { AuthenticatedCantonMessagingDirectory } from "../../src/messaging/canton/authenticated-directory.js";
import { CantonMessagingTransport } from "../../src/messaging/canton/transport.js";
import { CantonLiveMessagingSession } from "../../src/messaging/canton/live-session.js";
import { BrowserCantonLiveStateStore } from "../../src/messaging/canton/browser-live-state-store.js";
import { CantonPollingUpdateStream } from "./canton-polling-update-stream";
import type { CantonUpdateSubscription } from "../../src/canton/update-stream.js";
import type { CantonLedgerClient } from "../../src/canton/ledger-client.js";
import { CantonDappLedgerClient } from "./canton-dapp-ledger-client";
import {
  findInvitePeers,
  installationFor,
  inviteRequestId,
  ownInvites,
  type PrivateInvite,
} from "./canton-invite";
import { cantonNetwork } from "./workspace";
import { loadOpenMls } from "./canton-room-runtime";
export interface GroupRoomInput {
  conversationId: string;
  title: string;
  walletParty: string;
  hostParty: string;
  hostInstallation: string;
  creator: boolean;
  onMessages(messages: readonly PlainMessage[]): void;
  onState(snapshot: GroupSnapshot | undefined): void;
  onError(error: Error): void;
}
export class CantonGroupRuntime {
  private subscription?: CantonUpdateSubscription;
  private timer?: ReturnType<typeof setTimeout>;
  private closed = false;
  private queue: Promise<unknown> = Promise.resolve();
  private advertised = "";
  private constructor(
    private input: GroupRoomInput,
    private ledger: CantonLedgerClient,
    private bridge: BrowserOpenMlsBridge,
    private provider: OpenMlsMessagingProvider,
    private transport: CantonMessagingTransport,
    private history: IndexedDbPlaintextStore,
    private identity: {
      userId: string;
      installationId: string;
      credential: Uint8Array;
    },
    private bindings: Map<string, string>,
    private invite?: PrivateInvite,
  ) {}
  private run<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => {});
    return next;
  }
  static async connect(input: GroupRoomInput): Promise<CantonGroupRuntime> {
    const ledger = await CantonDappLedgerClient.connect(input.walletParty),
      auth = await ledger.getAuthenticatedIdentity();
    const installationId = installationFor(auth.userId),
      encoder = new TextEncoder(),
      decoder = new TextDecoder();
    if (
      input.creator &&
      (input.hostParty !== auth.primaryParty ||
        input.hostInstallation !== installationId)
    )
      throw new Error(
        "Open this group with its creator’s wallet and original device.",
      );
    if (!input.creator && input.hostParty === auth.primaryParty)
      throw new Error("Open the group from your saved rooms as its creator.");
    const invite = input.creator
      ? ownInvites(auth.primaryParty).find(
          (i) => i.id === input.conversationId && i.kind === "group",
        )
      : undefined;
    const bindings = new Map([
      [installationId, auth.primaryParty],
      [input.hostInstallation, input.hostParty],
    ]);
    if (invite)
      for (const p of findInvitePeers(
        await ledger.queryActiveContracts(auth.primaryParty),
        await inviteRequestId(invite),
        auth.primaryParty,
      ))
        bindings.set(p.installation, p.party);
    const bridge = new BrowserOpenMlsBridge(
      loadOpenMls,
      new IndexedDbOpenMlsCheckpointStore(),
    );
    const snapshot = async () => {
      try {
        return await bridge.getGroupSnapshot(input.conversationId);
      } catch {
        return undefined;
      }
    };
    const directory = await AuthenticatedCantonMessagingDirectory.connect(
      ledger,
      {
        localInstallationId: installationId,
        async resolvePartyForInstallation(id) {
          const known = bindings.get(id);
          if (known) return known;
          const member = (await snapshot())?.members.find(
            (m) => m.installationId === id,
          );
          if (member) return decoder.decode(member.credential);
          throw new Error("Unknown group installation");
        },
        async recipientsForConversation(id) {
          if (id !== input.conversationId) throw new Error("Unknown group");
          return [
            ...new Set(
              ((await snapshot())?.members ?? []).map((m) =>
                decoder.decode(m.credential),
              ),
            ),
          ].filter((p) => p !== auth.primaryParty);
        },
        async keyPackageReaders() {
          return [
            ...new Set([
              ...bindings.values(),
              ...((await snapshot())?.members ?? []).map((m) =>
                decoder.decode(m.credential),
              ),
            ]),
          ].filter((p) => p !== auth.primaryParty);
        },
      },
    );
    const transport = new CantonMessagingTransport(
        ledger,
        directory,
        async (id) => {
          const known = bindings.get(id);
          if (known) return known;
          const member = (await snapshot())?.members.find(
            (m) => m.installationId === id,
          );
          if (!member) throw new Error("Unknown group sender installation");
          return decoder.decode(member.credential);
        },
        async (id) => {
          if (!invite) return undefined;
          const requestId = await inviteRequestId(invite);
          const requests = (
            await ledger.queryActiveContracts(auth.primaryParty)
          )
            .filter(
              (c) =>
                c.templateId.endsWith(":Vinss.Messaging:KeyPackageRequest") &&
                c.createArgument.requestId === requestId &&
                c.createArgument.recipient === auth.primaryParty &&
                c.createArgument.requester === bindings.get(id) &&
                c.createArgument.installationId === id,
            )
            .sort((a, b) =>
              a.offset < b.offset ? -1 : a.offset > b.offset ? 1 : 0,
            );
          return requests[0]?.offset;
        },
      ),
      history = new IndexedDbPlaintextStore(
        JSON.stringify([cantonNetwork(), auth.primaryParty, installationId]),
      );
    const provider = new OpenMlsMessagingProvider(
      bridge,
      transport,
      undefined,
      { history, groupStateSender: input.hostInstallation },
    );
    const identity = {
      userId: auth.userId,
      installationId,
      credential: encoder.encode(auth.primaryParty),
    };
    await provider.initialize(identity);
    if (input.creator && !(await snapshot()))
      await provider.createGroup({
        conversationId: input.conversationId,
        title: input.title,
        creator: { ...identity, role: "super_admin" },
      });
    const runtime = new CantonGroupRuntime(
      input,
      ledger,
      bridge,
      provider,
      transport,
      history,
      identity,
      bindings,
      invite,
    );
    input.onMessages(await history.list(input.conversationId));
    const serialProvider = {
      initialize: provider.initialize.bind(provider),
      createGroup: provider.createGroup.bind(provider),
      addMembers: provider.addMembers.bind(provider),
      removeMembers: provider.removeMembers.bind(provider),
      send: provider.send.bind(provider),
      sync: (id: string, cursor?: string) =>
        runtime.run(() => provider.sync(id, cursor)),
    };
    const live = new CantonLiveMessagingSession(
      serialProvider,
      new CantonPollingUpdateStream({ ledger }),
      ledger,
      directory,
      installationId,
      new BrowserCantonLiveStateStore(
        window.localStorage,
        `vinss-canton:${cantonNetwork()}:${input.conversationId}`,
      ),
      (id) => id === input.conversationId,
    );
    try {
      runtime.subscription = await live.start({
        onMessages(id, messages) {
          if (id === input.conversationId && !runtime.closed)
            input.onMessages(messages);
        },
        onLedgerOffset() {
          return runtime.run(() => runtime.refreshState());
        },
        onError: input.onError,
      });
      await runtime.run(() => runtime.refresh());
      runtime.poll();
      return runtime;
    } catch (error) {
      await runtime.close();
      throw error;
    }
  }
  private async refreshState() {
    try {
      const s = await this.bridge.getGroupSnapshot(this.input.conversationId);
      if (!this.closed) this.input.onState(s);
    } catch {
      if (!this.closed) this.input.onState(undefined);
    }
  }
  private poll() {
    if (this.closed) return;
    this.timer = setTimeout(() => {
      void this.run(() => this.refresh())
        .catch((e) => {
          if (!this.closed)
            this.input.onError(e instanceof Error ? e : new Error(String(e)));
        })
        .finally(() => this.poll());
    }, 5000);
  }
  private async refresh() {
    if (this.closed) return;
    if (this.invite && this.invite.expires > Date.now())
      for (const p of findInvitePeers(
        await this.ledger.queryActiveContracts(this.input.walletParty),
        await inviteRequestId(this.invite),
        this.input.walletParty,
      ))
        this.bindings.set(p.installation, p.party);
    const snapshot = await this.bridge
      .getGroupSnapshot(this.input.conversationId)
      .catch(() => undefined);
    const readers = [
      ...new Set([
        ...this.bindings.keys(),
        ...(snapshot?.members ?? []).map((m) => m.installationId),
      ]),
    ]
      .sort()
      .join(":");
    if (readers !== this.advertised) {
      const now = Date.now();
      await this.transport.publishKeyPackage({
        installationId: this.identity.installationId,
        createdAt: now,
        expiresAt: now + 86400000,
        keyPackage: await this.bridge.createKeyPackage(),
      });
      this.advertised = readers;
    }
    if (this.input.creator) {
      for (const [installation, party] of this.bindings) {
        if (installation === this.identity.installationId) continue;
        const state = await this.bridge.getGroupSnapshot(
          this.input.conversationId,
        );
        if (state.members.some((m) => m.installationId === installation))
          continue;
        if (state.members.length >= 32)
          throw new Error("This group has reached its 32-member limit.");
        try {
          await this.provider.addMembers(this.input.conversationId, [
            {
              userId: `wallet:${party}`,
              installationId: installation,
              role: "member",
              credential: new TextEncoder().encode(party),
            },
          ]);
        } catch (e) {
          if (
            !/Missing MLS KeyPackage|No verified Canton party binding/.test(
              String(e),
            )
          )
            throw e;
        }
      }
    }
    await this.refreshState();
  }
  sendText(text: string) {
    return this.run(async () => {
      const clean = text.trim();
      if (!clean || clean.length > 10000)
        throw new Error("Write a message of 1–10,000 characters.");
      const state = await this.bridge.getGroupSnapshot(
        this.input.conversationId,
      );
      if (state.members.length < 2)
        throw new Error("Wait for another member to join.");
      const message: PlainMessage = {
        id: crypto.randomUUID(),
        conversationId: this.input.conversationId,
        senderUserId: this.identity.userId,
        senderInstallationId: this.identity.installationId,
        sentAt: Date.now(),
        content: { type: "text", text: clean },
      };
      await this.provider.send(message);
      return message;
    });
  }
  async close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.subscription?.close();
    await this.queue;
  }
}
