import type * as CantonSdk from "@canton-network/dapp-sdk";
let sdkPromise: Promise<typeof CantonSdk> | undefined;
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
export async function verifiedWalletAccounts(): Promise<CantonSdk.Wallet[]> {
  const sdk = await loadCantonWalletSdk();
  const status = await sdk.status();
  if (!status.connection.isConnected) throw new Error("Wallet disconnected. Connect again.");
  if (!status.connection.isNetworkConnected)
    throw new Error("Your wallet is not connected to Canton. Select a connected network in the wallet and retry.");
  const expected = process.env.NEXT_PUBLIC_CANTON_WALLET_NETWORK_ID?.trim() ||
    (process.env.NEXT_PUBLIC_CANTON_NETWORK || "devnet").trim().toLowerCase();
  const actual = status.network?.networkId;
  if (!actual || (actual !== expected && actual !== `canton:${expected}`))
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
