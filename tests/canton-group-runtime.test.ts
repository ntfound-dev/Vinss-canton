import { it, expect, vi, afterEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import type {
  CantonLedgerClient,
  CantonCreatedContract,
} from "../src/canton/ledger-client.js";
import type { PlainMessage, GroupSnapshot } from "../src/messaging/types.js";
const clients = vi.hoisted(() => new Map<string, CantonLedgerClient>());
vi.mock("../frontend/lib/canton-dapp-ledger-client", () => ({
  CantonDappLedgerClient: {
    connect: async (party: string) => clients.get(party),
  },
}));
vi.mock("../frontend/lib/canton-room-runtime", async () => {
  const wasm = await import("../frontend/lib/openmls/vinss_mls.js");
  const fs = await import("node:fs");
  wasm.initSync({
    module: fs.readFileSync("frontend/lib/openmls/vinss_mls_bg.wasm"),
  });
  const actual = await vi.importActual<
    typeof import("../frontend/lib/canton-room-runtime")
  >("../frontend/lib/canton-room-runtime");
  return { ...actual, loadOpenMls: async () => wasm };
});
import {
  CantonRoomRuntime,
  type CantonRoomMessage,
} from "../frontend/lib/canton-room-runtime";
import { CantonGroupRuntime } from "../frontend/lib/canton-group-runtime";
import {
  makeInvite,
  saveInvite,
  registerInvite,
  installationFor,
} from "../frontend/lib/canton-invite";
const rooms: (CantonGroupRuntime | CantonRoomRuntime)[] = [];
afterEach(async () => {
  for (const r of rooms.splice(0)) await r.close();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clients.clear();
});
it("real WASM runtime admits two wallet-bound guests and delivers group messages without manual peer IDs", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const storage = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    key: (i: number) => [...storage.keys()][i] ?? null,
    get length() {
      return storage.size;
    },
  };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage, crypto: globalThis.crypto });
  vi.stubGlobal("indexedDB", new IDBFactory());
  const records: CantonCreatedContract[] = [];
  let offset = 0n;
  const visible = (c: CantonCreatedContract, p: string) =>
    [
      c.createArgument.sender,
      c.createArgument.owner,
      c.createArgument.requester,
      c.createArgument.recipient,
      ...((c.createArgument.recipients as string[]) ?? []),
    ].includes(p);
  for (const party of ["Alice", "Bob", "Charlie"])
    clients.set(party, {
      async getAuthenticatedIdentity() {
        return {
          userId: `wallet:${party}`,
          primaryParty: party,
          canActAs: [party],
          canReadAs: [party],
        };
      },
      async submitCreates(input) {
        expect(input.actingParty).toBe(party);
        for (const c of input.creates)
          records.push({
            contractId: crypto.randomUUID(),
            templateId: c.templateId,
            offset: ++offset,
            createArgument: structuredClone(c.createArguments),
          });
        return { updateId: crypto.randomUUID(), completionOffset: offset };
      },
      async submitExercise() {
        throw new Error("Not used");
      },
      async queryActiveContracts(p) {
        expect(p).toBe(party);
        return records.filter((c) => visible(c, p));
      },
      async queryActiveContractsSnapshot(p) {
        return { offset, contracts: await this.queryActiveContracts(p) };
      },
      async queryCreatedContractsSince(p, after) {
        return (await this.queryActiveContracts(p)).filter(
          (c) => c.offset > after,
        );
      },
    });
  const invite = makeInvite("Alice", "Runtime group", "group");
  saveInvite(invite);
  const received = new Map<string, PlainMessage[]>();
  const states = new Map<string, GroupSnapshot | undefined>();
  const errors: Error[] = [];
  async function connect(party: string) {
    const runtime = await CantonGroupRuntime.connect({
      conversationId: invite.id,
      title: invite.title,
      walletParty: party,
      hostParty: invite.host,
      hostInstallation: invite.installation,
      creator: party === "Alice",
      onMessages: (m) =>
        received.set(party, [...(received.get(party) ?? []), ...m]),
      onState: (s) => states.set(party, s),
      onError: (e) => errors.push(e),
    });
    rooms.push(runtime);
    return runtime;
  }
  const alice = await connect("Alice");
  await registerInvite(clients.get("Bob")!, invite, "Bob");
  const bob = await connect("Bob");
  await registerInvite(clients.get("Charlie")!, invite, "Charlie");
  await connect("Charlie");
  await vi.advanceTimersByTimeAsync(7000);
  await vi.waitFor(
    () => {
      for (const p of ["Alice", "Bob", "Charlie"])
        expect(
          states.get(p)?.members.length,
          `${p} membership; errors ${errors.map((e) => e.message)}`,
        ).toBe(3);
    },
    { timeout: 15000, interval: 250 },
  );
  const a = await alice.sendText("Alice to all");
  await vi.advanceTimersByTimeAsync(2000);
  const b = await bob.sendText("Bob to all");
  await vi.advanceTimersByTimeAsync(2000);
  await vi.waitFor(
    () => {
      expect(received.get("Bob")?.some((m) => m.id === a.id)).toBe(true);
      expect(received.get("Charlie")?.some((m) => m.id === a.id)).toBe(true);
      expect(received.get("Alice")?.some((m) => m.id === b.id)).toBe(true);
      expect(received.get("Charlie")?.some((m) => m.id === b.id)).toBe(true);
      expect(
        new Set(
          ["Alice", "Bob", "Charlie"].map((p) =>
            installationFor(`wallet:${p}`),
          ),
        ).size,
      ).toBe(3);
      expect(errors.map((e) => e.message)).toEqual([]);
    },
    { timeout: 10000, interval: 250 },
  );
  // Also exercise the real private-room runtime and its history restore path.
  for (const r of rooms.splice(0)) await r.close();
  const privateId = crypto.randomUUID(),
    privateMessages = new Map<string, CantonRoomMessage[]>();
  const statuses = new Map<string, string>();
  async function privateRoom(party: string) {
    const peer = party === "Alice" ? "Bob" : "Alice";
    const r = await CantonRoomRuntime.connect({
      conversationId: privateId,
      walletParty: party,
      peerParty: peer,
      peerInstallationId: installationFor(`wallet:${peer}`),
      creator: party === "Alice",
      onStatus: (status) => statuses.set(party, status),
      onMessages: (m) =>
        privateMessages.set(party, [
          ...(privateMessages.get(party) ?? []),
          ...m,
        ]),
      onError: (e) => errors.push(e),
    });
    rooms.push(r);
    return r;
  }
  let bobPrivate = await privateRoom("Bob");
  const alicePrivate = await privateRoom("Alice");
  await vi.waitFor(() => expect(statuses.get("Bob")).toBe("ready"), {
    timeout: 10000,
    interval: 250,
  });
  const toBob = await alicePrivate.sendText("Private Alice to Bob");
  await vi.waitFor(
    () =>
      expect(privateMessages.get("Bob")?.some((m) => m.id === toBob.id)).toBe(
        true,
      ),
    { timeout: 10000, interval: 250 },
  );
  const toAlice = await bobPrivate.sendText("Private Bob to Alice");
  await vi.waitFor(
    () =>
      expect(
        privateMessages.get("Alice")?.some((m) => m.id === toAlice.id),
      ).toBe(true),
    { timeout: 10000, interval: 250 },
  );
  bobPrivate.close();
  privateMessages.set("Bob", []);
  bobPrivate = await privateRoom("Bob");
  expect(privateMessages.get("Bob")?.map((m) => m.id)).toEqual([
    toBob.id,
    toAlice.id,
  ]);
  expect(errors.map((e) => e.message)).toEqual([]);
}, 30000);
