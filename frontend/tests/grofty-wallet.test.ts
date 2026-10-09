import { beforeEach, describe, expect, it, vi } from "vitest";
import { GroftyClient, GroftyRpcError, type Cip0103Provider } from "@groftylabs/dapp-sdk";
import { groftyWalletAdapter, networkMatches, walletErrorMessage, discoverGrofty } from "../lib/grofty-wallet";

function setup() {
  const request = vi.fn(async ({ method }: { method: string; params?: unknown }): Promise<unknown> => {
    if (method === "getPrimaryAccount") return { partyId: "Alice", primary: true, status: "allocated" };
    if (method === "prepareExecuteAndWait") return { tx: { status: "executed", commandId: "cmd", payload: { updateId: "real-wallet-receipt", completionOffset: 12 } } };
    return undefined;
  });
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const provider = { request, on: vi.fn((event, fn) => handlers.set(event, fn)), removeListener: vi.fn((event) => handlers.delete(event)) } as unknown as Cip0103Provider;
  return { request, provider, handlers, adapter: groftyWalletAdapter(new GroftyClient(provider)) };
}
describe("Grofty direct SDK boundary (fake provider, no live ledger)", () => {
  beforeEach(() => vi.unstubAllGlobals());
  it("recognizes official network ID without accepting mainnet on devnet", () => {
    expect(networkMatches("canton:da-mainnet", "mainnet")).toBe(true);
    expect(networkMatches("canton:da-mainnet", "devnet")).toBe(false);
    expect(networkMatches("canton:da-mainnet", "canton:da-mainnet")).toBe(true);
    expect(networkMatches("other", "mainnet")).toBe(false);
  });
  it("never reports an absent provider as connected", async () => {
    await expect(discoverGrofty()).rejects.toThrow("not detected");
  });
  it("forwards authorization, retains numeric rejection and maps recovery text", async () => {
    const { adapter, request } = setup();
    request.mockRejectedValueOnce(new GroftyRpcError("declined", 4001));
    await expect(adapter.connect()).rejects.toMatchObject({ code: 4001 });
    expect(request).toHaveBeenCalledWith({ method: "connect" });
    expect(walletErrorMessage(new GroftyRpcError("declined", 4001))).toContain("rejected");
    expect(walletErrorMessage(new GroftyRpcError("locked", 4100))).toContain("Unlock");
    expect(walletErrorMessage(new GroftyRpcError("expired", -32603))).toContain("timed out");
  });
  it("uses only the primary allocated signing account", async () => {
    const { adapter, request } = setup();
    request.mockResolvedValueOnce([{ partyId: "Alice", primary: true, status: "allocated" }, { partyId: "Bob", primary: false, status: "allocated" }, { partyId: "Pending", primary: true, status: "pending" }]);
    expect((await adapter.listAccounts()).map(a => a.partyId)).toEqual(["Alice"]);
  });
  it("strips checked actAs and preserves disclosure and execution receipt", async () => {
    const { adapter, request } = setup();
    const input = { commands: [{ CreateCommand: { templateId: "pkg:Test:Contract", createArguments: {} } }], actAs: ["Alice"], readAs: ["Alice"], disclosedContracts: [{ templateId: "T", contractId: "C", createdEventBlob: "blob", synchronizerId: "S" }], commandId: "cmd", synchronizerId: "S" };
    const receipt = await adapter.prepareExecuteAndWait(input);
    expect(receipt.tx.payload.updateId).toBe("real-wallet-receipt");
    const { actAs, ...expected } = input;
    expect(request).toHaveBeenLastCalledWith({ method: "prepareExecuteAndWait", params: expected });
  });
  it("rejects other-party authority before sending any command", async () => {
    const { adapter, request } = setup();
    await expect(adapter.prepareExecuteAndWait({ commands: [{ CreateCommand: { templateId: "pkg:Test:Contract", createArguments: {} } }], actAs: ["Bob"] })).rejects.toThrow("active Party");
    expect(request).toHaveBeenCalledTimes(1);
    await expect(adapter.prepareExecuteAndWait({ commands: [{ CreateCommand: { templateId: "pkg:Test:Contract", createArguments: {} } }], readAs: ["Bob"] })).rejects.toThrow("active Party");
  });
  it("does not invent receipts for old wallet responses", async () => {
    const { adapter, request } = setup();
    request.mockResolvedValueOnce({ partyId: "Alice", status: "allocated" }).mockResolvedValueOnce(undefined);
    await expect(adapter.prepareExecuteAndWait({ commands: [{ CreateCommand: { templateId: "pkg:Test:Contract", createArguments: {} } }] })).rejects.toThrow("no execution receipt");
  });
  it("supports ledger-end while rejecting unsupported update streams explicitly", async () => {
    const { adapter, request } = setup();
    request.mockResolvedValueOnce({ offset: 21 });
    expect(await adapter.ledgerApi({ resource: "/v2/state/ledger-end", requestMethod: "get" })).toEqual({ offset: 21 });
    await expect(adapter.ledgerApi({ resource: "/v2/updates", requestMethod: "post" })).rejects.toThrow("full Ledger API");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("subscribes to account changes and removes the exact listener", async () => {
    const { adapter, provider, handlers } = setup();
    const changed = vi.fn();
    await adapter.onAccountsChanged(changed);
    handlers.get("accountsChanged")?.([{ partyId: "Alice", primary: true, status: "allocated" }]);
    expect(changed).toHaveBeenCalledWith([expect.objectContaining({ partyId: "Alice" })]);
    await adapter.removeOnAccountsChanged(changed);
    expect(provider.removeListener).toHaveBeenCalledTimes(1);
    expect(handlers.has("accountsChanged")).toBe(false);
  });
});
