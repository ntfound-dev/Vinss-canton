import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { IndexedDbPlaintextStore } from "../src/messaging/local/plaintext-store.js";
import {
  makeInvite,
  encodeInvite,
  decodeInvite,
  findInvitePeers,
  registerInvite,
  inviteRequestId,
  installationFor,
  groupBookmark,
} from "../frontend/lib/canton-invite";
import { roomUrl } from "../frontend/lib/workspace";
import type { PlainMessage } from "../src/messaging/types.js";
import type {
  CantonLedgerClient,
  CantonCreatedContract,
} from "../src/canton/ledger-client.js";
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    key: (i: number) => [...values.keys()][i] ?? null,
    get length() {
      return values.size;
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
const message = (id: string, room = "r", sentAt = 1): PlainMessage => ({
  id,
  conversationId: room,
  senderUserId: "Alice",
  senderInstallationId: "a",
  sentAt,
  content: { type: "text", text: "secret text" },
});
describe("local plaintext history", () => {
  it("survives fresh instances, deduplicates and sorts, keeps accounts/networks/rooms apart", async () => {
    const factory = new IDBFactory();
    const a = new IndexedDbPlaintextStore("devnet:Alice:a", factory);
    await a.save(message("later", "r", 2));
    await a.save(message("first"));
    await a.save(message("first"));
    await a.save(message("other", "other"));
    const reload = new IndexedDbPlaintextStore("devnet:Alice:a", factory);
    expect((await reload.list("r")).map((m) => m.id)).toEqual([
      "first",
      "later",
    ]);
    expect((await reload.get("r", "first"))?.content).toEqual({
      type: "text",
      text: "secret text",
    });
    expect(
      await new IndexedDbPlaintextStore("devnet:Bob:b", factory).list("r"),
    ).toEqual([]);
    expect(
      await new IndexedDbPlaintextStore("testnet:Alice:a", factory).list("r"),
    ).toEqual([]);
    await reload.markProcessed("r", "group-state:1");
    expect(await reload.hasProcessed("r", "group-state:1")).toBe(true);
    expect((await reload.list("r")).length).toBe(2);
    await reload.clear("r");
    expect(await a.list("r")).toEqual([]);
    expect(await a.hasProcessed("r", "group-state:1")).toBe(false);
    expect((await a.list("other")).length).toBe(1);
  });
});
describe("QR and group invites", () => {
  it("QR scan returns the exact URL including secret fragment and Unicode title", () => {
    const invite = makeInvite(
      "Host::" + "a".repeat(68),
      "Grup desain café",
      "group",
    );
    const url = `https://vinss-canton.vercel.app/invite#${encodeInvite(invite)}`;
    const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
    const size = qr.modules.size,
      scale = 8,
      quiet = 4,
      width = (size + quiet * 2) * scale;
    const pixels = new Uint8ClampedArray(width * width * 4);
    for (let y = 0; y < width; y++)
      for (let x = 0; x < width; x++) {
        const mx = Math.floor(x / scale) - quiet,
          my = Math.floor(y / scale) - quiet;
        const dark =
          mx >= 0 &&
          my >= 0 &&
          mx < size &&
          my < size &&
          qr.modules.get(my, mx);
        const i = (y * width + x) * 4;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = dark ? 0 : 255;
        pixels[i + 3] = 255;
      }
    const decoded = jsQR(pixels, width, width);
    expect(decoded?.data).toBe(url);
    expect(decodeInvite(decoded!.data.split("#")[1]!)).toEqual(invite);
    expect(roomUrl(groupBookmark(invite, true))).toContain(
      `/group/${invite.id}?`,
    );
  });
  it("accepts separate signed group join requests, binds own installation idempotently", async () => {
    const invite = makeInvite("Host", "Group", "group"),
      requestId = await inviteRequestId(invite);
    const guest = installationFor("wallet:Guest"),
      other = installationFor("wallet:Other");
    const contract = (
      party: string,
      id: string,
      offset: bigint,
    ): CantonCreatedContract => ({
      contractId: `request-${offset}`,
      offset,
      templateId: "pkg:Vinss.Messaging:KeyPackageRequest",
      createArgument: {
        requestId,
        requester: party,
        recipient: "Host",
        installationId: id,
      },
    });
    const contracts = [
      contract("Other", other, 1n),
      contract("Guest", guest, 2n),
      contract("Guest", other, 3n),
    ];
    expect(findInvitePeers(contracts, requestId, "Host")).toEqual([
      { party: "Other", installation: other },
      { party: "Guest", installation: guest },
    ]);
    const submitCreates = vi.fn();
    const ledger = {
      getAuthenticatedIdentity: async () => ({
        userId: "wallet:Guest",
        primaryParty: "Guest",
      }),
      queryActiveContracts: async () => contracts,
      submitCreates,
    } as unknown as CantonLedgerClient;
    expect((await registerInvite(ledger, invite, "Guest")).kind).toBe("group");
    expect(submitCreates).not.toHaveBeenCalled();
  });
  it("rejects JSON null and unknown invite kind", () => {
    expect(() => decodeInvite(btoa("null"))).toThrow(/valid/);
    expect(() =>
      decodeInvite(
        encodeInvite({ ...makeInvite("Host"), kind: "payment" as "group" }),
      ),
    ).toThrow(/valid/);
  });
});
