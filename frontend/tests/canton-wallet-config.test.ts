import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@canton-network/dapp-sdk", () => ({ status: vi.fn(), listAccounts: vi.fn() }));
import { gatewayRpcUrl, loadCantonWalletSdk, verifiedWalletAccounts } from "../lib/canton-wallet-config";
describe("Canton wallet boundary", () => {
  beforeEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("preserves a custom RPC path and supplies the default only for a gateway origin", () => {
    expect(gatewayRpcUrl("https://wallet.example/")).toBe("https://wallet.example/api/v0/dapp");
    expect(gatewayRpcUrl("https://wallet.example/api/json-rpc/")).toBe("https://wallet.example/api/json-rpc");
  });
  it("rejects insecure production gateways and credential-bearing URLs", () => {
    expect(() => gatewayRpcUrl("https://user:secret@wallet.example")).toThrow("credentials");
    expect(() => gatewayRpcUrl("https://wallet.example?token=secret")).toThrow("credentials");
    expect(() => gatewayRpcUrl("http://wallet.example")).toThrow("HTTPS");
    vi.stubGlobal("location", { protocol: "https:" });
    expect(() => gatewayRpcUrl("http://localhost:3030")).toThrow("HTTPS");
  });
  it("rejects a connected wallet on the wrong network", async () => {
    const sdk = await loadCantonWalletSdk();
    vi.mocked(sdk.status).mockResolvedValue({ connection: { isConnected: true, isNetworkConnected: true }, provider: { id: "test" }, network: { networkId: "mainnet" } });
    await expect(verifiedWalletAccounts()).rejects.toThrow("does not match devnet");
  });
  it("excludes disabled, unallocated, and other-network accounts", async () => {
    const sdk = await loadCantonWalletSdk();
    vi.mocked(sdk.status).mockResolvedValue({ connection: { isConnected: true, isNetworkConnected: true }, provider: { id: "test" }, network: { networkId: "devnet" } });
    vi.mocked(sdk.listAccounts).mockResolvedValue([
      { partyId: "Alice", status: "allocated", networkId: "devnet" },
      { partyId: "disabled", status: "allocated", networkId: "devnet", disabled: true },
      { partyId: "pending", status: "initialized", networkId: "devnet" },
      { partyId: "Bob", status: "allocated", networkId: "mainnet" },
    ] as Awaited<ReturnType<typeof sdk.listAccounts>>);
    expect((await verifiedWalletAccounts()).map(a => a.partyId)).toEqual(["Alice"]);
  });
});
