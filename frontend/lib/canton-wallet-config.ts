import { discoverGrofty, networkMatches } from "./grofty-wallet";
import type * as CantonSdk from "@canton-network/dapp-sdk";
let sdkPromise: Promise<typeof CantonSdk> | undefined;
export type WalletKind = "canton" | "grofty";
let selected: WalletKind = "canton";
let grofty: Awaited<ReturnType<typeof discoverGrofty>> | undefined;
export async function selectWallet(kind: WalletKind) {
  if (kind === "grofty") {
    const found = await discoverGrofty();
    const probe = await found.status();
    const expected = expectedNetwork();
    if (!probe.network?.networkId || !networkMatches(probe.network.networkId, expected))
      throw new Error(`Grofty is MainNet only (${probe.network?.networkId || "unknown network"}). This VINSS deployment expects ${expected}. Use a wallet supporting this deployment network. A separate MainNet deployment needs matching Canton contracts and registries.`);
    grofty = found;
  } else await initCantonWalletSdk();
  selected = kind;
}
export async function restoreWalletSelection() {
  let saved: string | null = null;
  try { saved = localStorage.getItem("vinss.wallet.kind"); } catch {}
  if (saved === "grofty") await selectWallet("grofty");
  else await initCantonWalletSdk();
}
export function rememberWalletSelection() {
  try { localStorage.setItem("vinss.wallet.kind", selected); } catch {}
}
export function forgetWalletSelection() {
  try { localStorage.removeItem("vinss.wallet.kind"); } catch {}
}
export async function loadActiveWalletSdk() {
  return selected === "grofty" && grofty ? grofty : loadCantonWalletSdk();
}
let initPromise: Promise<void> | undefined;
export function loadCantonWalletSdk() {
  return (sdkPromise ??= import("@canton-network/dapp-sdk").catch((error) => {
    sdkPromise = undefined;
    throw error;
  }));
}
export function initCantonWalletSdk(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const sdk = await loadCantonWalletSdk();
    const gateway = process.env.NEXT_PUBLIC_CANTON_WALLET_GATEWAY_URL?.trim();
    if (!gateway) {
      await sdk.init({ defaultAdapters: recentGatewayAdapters(sdk), additionalAdapters: walletConnectAdapters(sdk) });
      return;
    }
    const clean = gatewayRpcUrl(gateway);
    await sdk.init({
      additionalAdapters: walletConnectAdapters(sdk),
      defaultAdapters: [
        new sdk.RemoteAdapter({
          name:
            process.env.NEXT_PUBLIC_CANTON_WALLET_GATEWAY_NAME?.trim() ||
            "VINSS Canton Wallet",
          rpcUrl: clean,
        }),
      ],
    });
  })().catch((error) => {
    initPromise = undefined;
    throw error;
  });
  return initPromise;
}

// A gateway is a CIP-103 RPC endpoint, not a validator Ledger API URL.
export function gatewayRpcUrl(value: string): string {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash)
    throw new Error("Wallet gateway URL must not contain credentials, query parameters, or fragments.");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
    throw new Error("Use an HTTPS wallet gateway (HTTP is allowed only for local development).");
  if (typeof location !== "undefined" && location.protocol === "https:" && url.protocol !== "https:")
    throw new Error("An HTTPS application requires an HTTPS wallet gateway.");
  if (url.pathname === "/") url.pathname = "/api/v0/dapp";
  return url.toString().replace(/\/+$/, "");
}
function walletConnectAdapters(sdk: typeof CantonSdk) {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
  if (!projectId) return [];
  const network = (process.env.NEXT_PUBLIC_CANTON_NETWORK || "devnet").trim().toLowerCase();
  if (!["devnet", "testnet", "mainnet"].includes(network)) throw new Error("Invalid Canton network configuration.");
  return [new sdk.WalletConnectAdapter({
    projectId,
    chainId: `canton:${network}`,
    metadata: { name: "VINSS", description: "Private deals on Canton", url: location.origin, icons: [] },
  })];
}
function expectedNetwork() {
  return process.env.NEXT_PUBLIC_CANTON_WALLET_NETWORK_ID?.trim() ||
    (process.env.NEXT_PUBLIC_CANTON_NETWORK || "devnet").trim().toLowerCase();
}
export async function verifiedWalletAccounts(): Promise<CantonSdk.Wallet[]> {
  const sdk = await loadActiveWalletSdk();
  const status = await sdk.status();
  if (!status.connection.isConnected) throw new Error("Wallet disconnected. Connect again.");
  if (!status.connection.isNetworkConnected)
    throw new Error("Your wallet is not connected to Canton. Select a connected network in the wallet and retry.");
  const expected = expectedNetwork();
  const actual = status.network?.networkId;
  if (!actual || !networkMatches(actual, expected))
    throw new Error(`Wallet network ${actual || "unknown"} does not match ${expected}. Switch the wallet network or open the matching VINSS deployment.`);
  return (await sdk.listAccounts()).filter(a => a.status === "allocated" && !a.disabled && a.partyId &&
    (a.networkId === actual));
}

function recentGatewayAdapters(sdk: typeof CantonSdk): CantonSdk.RemoteAdapter[] {
  try {
    const entries: unknown = JSON.parse(localStorage.getItem("splice_wallet_picker_recent") || "[]");
    if (!Array.isArray(entries)) return [];
    return entries.slice(0, 5).flatMap(entry => {
      try {
        if (typeof entry?.rpcUrl !== "string") return [];
        return [new sdk.RemoteAdapter({ name: typeof entry.name === "string" ? entry.name : "Recent gateway", rpcUrl: gatewayRpcUrl(entry.rpcUrl) })];
      } catch { return []; }
    });
  } catch { return []; }
}
