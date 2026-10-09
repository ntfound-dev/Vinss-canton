import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  create: vi.fn(), status: vi.fn(), accounts: vi.fn(), connect: vi.fn(), init: vi.fn(),
}));
vi.mock("@groftylabs/dapp-sdk", async (original) => ({ ...await original<typeof import("@groftylabs/dapp-sdk")>(), createGroftyClient: mock.create }));
vi.mock("@canton-network/dapp-sdk", () => ({ init: mock.init, status: mock.status, listAccounts: mock.accounts, RemoteAdapter: class {}, WalletConnectAdapter: class {} }));
let config: typeof import("../lib/canton-wallet-config");
const primary = { partyId: "Alice", primary: true, status: "allocated", networkId: "canton:da-mainnet" };
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  mock.create.mockResolvedValue({ status: async () => ({ provider: { id: "grofty", version: "2.0.4" }, connection: { isConnected: true, isNetworkConnected: true }, network: { networkId: "canton:da-mainnet" } }), listAccounts: async () => [primary], connect: mock.connect });
  config = await import("../lib/canton-wallet-config");
});
it("rejects Grofty mainnet on a DevNet app before prompting approval", async () => {
  await expect(config.selectWallet("grofty")).rejects.toThrow("MainNet only");
  expect(mock.connect).not.toHaveBeenCalled();
});
it("accepts the official mainnet ID on a mainnet deployment", async () => {
  vi.stubEnv("NEXT_PUBLIC_CANTON_NETWORK", "mainnet");
  await config.selectWallet("grofty");
  expect((await config.verifiedWalletAccounts())[0].partyId).toBe("Alice");
  expect(mock.init).not.toHaveBeenCalled();
});
it("keeps the existing Canton connection route when switching away from Grofty", async () => {
  vi.stubEnv("NEXT_PUBLIC_CANTON_NETWORK", "mainnet");
  await config.selectWallet("grofty");
  await config.selectWallet("canton");
  expect(mock.init).toHaveBeenCalledWith({ defaultAdapters: [], additionalAdapters: [] });
  expect((await config.loadActiveWalletSdk()).status).toBe(mock.status);
});
it("restores only the selected wallet and does not fall back silently when absent", async () => {
  vi.stubGlobal("localStorage", { getItem: () => "grofty" });
  mock.create.mockResolvedValue(null);
  await expect(config.restoreWalletSelection()).rejects.toThrow("not detected");
  expect(mock.init).not.toHaveBeenCalled();
});
