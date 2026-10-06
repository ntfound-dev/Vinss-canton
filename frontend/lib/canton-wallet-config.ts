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
      await sdk.init();
      return;
    }
    const clean = gateway.replace(/\/+$/, "");
    await sdk.init({
      defaultAdapters: [
        new sdk.RemoteAdapter({
          name:
            process.env.NEXT_PUBLIC_CANTON_WALLET_GATEWAY_NAME?.trim() ||
            "VINSS Canton Wallet",
          rpcUrl: clean.endsWith("/api/v0/dapp")
            ? clean
            : clean + "/api/v0/dapp",
        }),
      ],
    });
  })().catch((error) => {
    initPromise = undefined;
    throw error;
  });
  return initPromise;
}
