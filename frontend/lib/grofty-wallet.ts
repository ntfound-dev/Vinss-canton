import { createGroftyClient, type GroftyClient, type CantonAccount, type StatusEvent } from "@groftylabs/dapp-sdk";
import type * as CantonSdk from "@canton-network/dapp-sdk";

export const GROFTY_EXTENSION_URL = "https://chromewebstore.google.com/detail/grofty-wallet/ojlgdkgfbpkjceancgnniegbgadgmhig";
export const GROFTY_ANDROID_URL = "https://play.google.com/store/apps/details?id=com.groftylab.grofty";
export const GROFTY_ABSENT = "Grofty was not detected in this browser. Use Grofty Wallet 2.0.4+ in a supported desktop browser, unlock it, and reload VINSS. Installing the Android app does not inject its provider into Chrome Android. The official SDK does not document an Android Chrome deep-link or pairing transport.";

export function networkMatches(actual: string, expected: string): boolean {
  if (actual === expected) return true;
  const aliases: Record<string, string[]> = {
    mainnet: ["mainnet", "canton:mainnet", "canton:da-mainnet"],
    testnet: ["testnet", "canton:testnet", "canton:da-testnet"],
    devnet: ["devnet", "canton:devnet", "canton:da-devnet"],
  };
  return Boolean(aliases[expected]?.includes(actual));
}
function accounts(values: CantonAccount[]): CantonSdk.Wallet[] {
  // Grofty signs only with the active (primary) account. Never grant authority for the others.
  return values.filter(a => a.primary && a.status === "allocated").map(a => ({ ...a, status: "allocated" }));
}
function status(value: StatusEvent): CantonSdk.StatusEvent {
  return { ...value, connection: { ...value.connection, isNetworkConnected: value.connection.isNetworkConnected ?? Boolean(value.network?.networkId) } };
}
export function groftyWalletAdapter(client: GroftyClient) {
  const accountListeners = new Map<(a: CantonSdk.Wallet[]) => void, () => void>();
  const statusListeners = new Map<(s: CantonSdk.StatusEvent) => void, () => void>();
  return {
    connect: () => client.connect(),
    disconnect: () => client.disconnect(),
    isConnected: () => client.isConnected(),
    status: async () => status(await client.status()),
    listAccounts: async () => accounts(await client.listAccounts()),
    onAccountsChanged: async (fn: (a: CantonSdk.Wallet[]) => void) => {
      accountListeners.get(fn)?.();
      accountListeners.set(fn, client.on("accountsChanged", a => fn(accounts(a))));
    },
    removeOnAccountsChanged: async (fn: (a: CantonSdk.Wallet[]) => void) => { accountListeners.get(fn)?.(); accountListeners.delete(fn); },
    onStatusChanged: async (fn: (s: CantonSdk.StatusEvent) => void) => {
      statusListeners.get(fn)?.();
      statusListeners.set(fn, client.on("statusChanged", s => fn(status(s))));
    },
    removeOnStatusChanged: async (fn: (s: CantonSdk.StatusEvent) => void) => { statusListeners.get(fn)?.(); statusListeners.delete(fn); },
    ledgerApi: async (params: CantonSdk.LedgerApiParams): Promise<unknown> => {
      const allowed = ["/v2/state/ledger-end", "/v2/state/active-contracts", "/v2/updates/update-by-id", "/v2/events/events-by-contract-id"];
      if (!allowed.includes(params.resource)) throw new Error(`Grofty does not support ${params.resource}. This workflow requires a Canton wallet with the full Ledger API. No fallback transaction was submitted.`);
      // Keep the format required for interface queries. Grofty may reject unsupported filters;
      // never silently treat those contracts as ordinary template contracts.
      return client.request("ledgerApi", params);
    },
    prepareExecuteAndWait: async (params: CantonSdk.PrepareExecuteParams): Promise<CantonSdk.PrepareExecuteAndWaitResult> => {
      const primary = await client.getPrimaryAccount();
      if (!primary || primary.status !== "allocated") throw new Error("Select an allocated Grofty account before submitting.");
      const input = params as CantonSdk.PrepareExecuteParams & { actAs?: string[]; readAs?: string[] };
      if (input.actAs?.some(p => p !== primary.partyId) || input.readAs?.some(p => p !== primary.partyId))
        throw new Error("Grofty supports only its active Party ID. Select the correct account and reconnect the room.");
      const { actAs: _actAs, ...singleParty } = input;
      // Grofty rejects actAs even when it names its own party; authority is checked above.
      const result = await client.prepareExecuteAndWait(singleParty);
      if (result?.tx?.status !== "executed" || !result.tx.payload?.updateId)
        throw new Error("Grofty returned no execution receipt. Check wallet activity before retrying; use Wallet 2.0.4+.");
      return result;
    },
  };
}
export async function discoverGrofty() {
  const client = await createGroftyClient({ discoveryTimeoutMs: 1200 });
  if (!client) throw new Error(GROFTY_ABSENT);
  return groftyWalletAdapter(client);
}
export function walletErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === 4001) return "Connection or transaction rejected in Grofty. You can retry when ready.";
  if (code === 4100) return "Grofty access is not authorized. Unlock/sign in to the wallet and approve VINSS again.";
  if (code === -32601) return "This wallet method is unavailable. Update Grofty to 2.0.4+; some VINSS ledger workflows require a wallet with the full Ledger API.";
  if (code === -32603) return "Grofty could not complete the request or approval timed out. Check wallet activity before retrying a transaction.";
  return error instanceof Error ? error.message : String(error);
}
