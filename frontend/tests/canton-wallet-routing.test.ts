import { beforeEach, expect, it, vi } from "vitest";
import { compatibleWalletEntries, type PickerEntry } from "../lib/canton-wallet-policy";

const state = vi.hoisted(() => ({ init: vi.fn(), pick: vi.fn(), create: vi.fn() }));
vi.mock("@canton-network/core-wallet-ui-components", () => ({ pickWallet: state.pick }));
vi.mock("@canton-network/dapp-sdk", () => ({
  DappSDK: class { constructor(options: unknown) { state.create(options); } init = state.init; },
  RemoteAdapter: class { constructor(public options: unknown) {} },
}));
const send: PickerEntry = { providerId: "browser:ext:ldmohiccoioolenadmogclhoklmanpgi", name: "Send Connect", type: "browser" };
const grofty: PickerEntry = { providerId: "browser:ext:ojlgdkgfbpkjceancgnniegbgadgmhig", name: "Grofty Wallet", type: "browser" };
const other: PickerEntry = { providerId: "browser:ext:devnet-wallet", name: "DevNet wallet", type: "browser" };
const remote: PickerEntry = { providerId: "remote:https://wallet.example/api/v0/dapp", name: "DevNet gateway", type: "remote", url: "https://wallet.example/api/v0/dapp" };
let config: typeof import("../lib/canton-wallet-config");
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  config = await import("../lib/canton-wallet-config");
});
it("excludes Send Connect and Grofty from DevNet without hiding other wallets", () => {
  expect(compatibleWalletEntries([send, grofty, other, remote], "devnet")).toEqual([other, remote]);
});
it("preserves Send on TestNet and both published wallets on MainNet", () => {
  expect(compatibleWalletEntries([send, grofty, other], "testnet")).toEqual([send, other]);
  expect(compatibleWalletEntries([send, grofty, other], "mainnet")).toEqual([send, grofty, other]);
});
it("fails before opening Send approval when it is the only discovered DevNet choice", async () => {
  await config.selectWallet("canton");
  const { walletPicker } = state.create.mock.calls[0][0];
  await expect(walletPicker([send])).rejects.toThrow("No devnet wallet");
  expect(state.pick).not.toHaveBeenCalled();
  expect(state.init).toHaveBeenCalledWith({ defaultAdapters: [], additionalAdapters: [], enableSuggestedWallets: false });
});
it("reports an absent gateway without invoking the SDK or another wallet", async () => {
  await expect(config.selectWallet("gateway")).rejects.toThrow("not configured");
  expect(state.create).not.toHaveBeenCalled();
  expect(state.pick).not.toHaveBeenCalled();
});
it("recreates a failed SDK initialization so a corrected configuration can retry", async () => {
  state.init.mockRejectedValueOnce(new Error("initialization failed"));
  await expect(config.selectWallet("canton")).rejects.toThrow("initialization failed");
  await config.selectWallet("canton");
  expect(state.create).toHaveBeenCalledTimes(2);
});
it("dedicated gateway route offers only the configured gateway, regardless of discovered extensions", async () => {
  vi.stubEnv("NEXT_PUBLIC_CANTON_WALLET_GATEWAY_URL", "https://wallet.example");
  await config.selectWallet("gateway");
  state.pick.mockResolvedValue(remote);
  const { walletPicker } = state.create.mock.calls[0][0];
  expect(await walletPicker([send, other, remote])).toEqual(remote);
  expect(state.pick).toHaveBeenCalledWith([remote]);
});
it("does not silently use an extension when the configured gateway was not discovered", async () => {
  vi.stubEnv("NEXT_PUBLIC_CANTON_WALLET_GATEWAY_URL", "https://wallet.example");
  await config.selectWallet("gateway");
  const { walletPicker } = state.create.mock.calls[0][0];
  await expect(walletPicker([other])).rejects.toThrow("No devnet wallet");
  expect(state.pick).not.toHaveBeenCalled();
});
it("retains the legacy extension picker on its supported deployment network", async () => {
  vi.stubEnv("NEXT_PUBLIC_CANTON_NETWORK", "testnet");
  await config.selectWallet("canton");
  state.pick.mockResolvedValue(send);
  const { walletPicker } = state.create.mock.calls[0][0];
  expect(await walletPicker([send, grofty])).toEqual(send);
  expect(state.pick).toHaveBeenCalledWith([send]);
});
