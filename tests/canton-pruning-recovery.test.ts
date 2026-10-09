import { describe, expect, it, vi } from "vitest";
import { HttpCantonLedgerClient } from "../src/canton/http-ledger-client.js";

function fixture(mode: "http-pruned" | "wallet-pruned" | "forbidden" | "normal" | "snapshot-failed") {
  const requests: { path: string; body?: any }[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ path, body });
    if (path === "/v2/state/ledger-end") return Response.json({ offset: 100 });
    if (path === "/v2/updates") {
      if (mode === "wallet-pruned") throw new Error("DevNet request failed: HTTP 400 (PARTICIPANT_PRUNED_DATA_ACCESSED)");
      if (mode === "forbidden") return Response.json({ code: "PERMISSION_DENIED" }, { status: 403 });
      if (mode !== "normal") return Response.json({ code: "PARTICIPANT_PRUNED_DATA_ACCESSED" }, { status: 400 });
      return Response.json([{ update: { Transaction: { events: [{ CreatedEvent: event(90) }] } } }]);
    }
    if (path === "/v2/state/active-contracts") {
      if (mode === "snapshot-failed") return Response.json({ code: "UNAVAILABLE" }, { status: 503 });
      return Response.json([90, 30, 75].map(offset => ({ contractEntry: { JsActiveContract: { createdEvent: event(offset) } } })));
    }
    throw new Error(`Unexpected path ${path}`);
  });
  const client = new HttpCantonLedgerClient({ baseUrl: "https://ledger.example", userId: "Alice", fetcher });
  return { client, requests };
}
function event(offset: number) {
  return { contractId: `contract-${offset}`, templateId: "pkg:Vinss.Messaging:MlsDelivery", offset, createArgument: { channelId: "room" } };
}

describe("pruned Canton messaging history", () => {
  it.each(["http-pruned", "wallet-pruned"] as const)("recovers %s from party-filtered ACS in original event order", async mode => {
    const { client, requests } = fixture(mode);
    expect((await client.queryCreatedContractsSince("Alice", 50n)).map(c => c.offset)).toEqual([75n, 90n]);
    const snapshot = requests.find(r => r.path === "/v2/state/active-contracts")!.body;
    expect(snapshot.activeAtOffset).toBe(100);
    expect(Object.keys(snapshot.eventFormat.filtersByParty)).toEqual(["Alice"]);
    expect(snapshot.eventFormat.filtersForAnyParty).toBeUndefined();
    expect(requests.some(r => r.path.includes("commands"))).toBe(false);
  });
  it("recovers a new cursor at zero, retaining the welcome before later events", async () => {
    const { client } = fixture("wallet-pruned");
    expect((await client.queryCreatedContractsSince("Alice", 0n)).map(c => c.offset)).toEqual([30n, 75n, 90n]);
  });
  it("does not hide authorization errors", async () => {
    const { client, requests } = fixture("forbidden");
    await expect(client.queryCreatedContractsSince("Alice", 0n)).rejects.toThrow("PERMISSION_DENIED");
    expect(requests.some(r => r.path === "/v2/state/active-contracts")).toBe(false);
  });
  it("does not report a successful recovery if ACS fails", async () => {
    const { client } = fixture("snapshot-failed");
    await expect(client.queryCreatedContractsSince("Alice", 0n)).rejects.toThrow("UNAVAILABLE");
  });
  it("continues using the update range when retained history is available", async () => {
    const { client, requests } = fixture("normal");
    expect((await client.queryCreatedContractsSince("Alice", 75n)).map(c => c.offset)).toEqual([90n]);
    expect(requests.find(r => r.path === "/v2/updates")!.body.beginExclusive).toBe(75);
    expect(requests.some(r => r.path === "/v2/state/active-contracts")).toBe(false);
  });
});
