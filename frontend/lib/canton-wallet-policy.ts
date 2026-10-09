import type { DappSDK } from "@canton-network/dapp-sdk";

type Picker = NonNullable<NonNullable<ConstructorParameters<typeof DappSDK>[0]>["walletPicker"]>;
export type PickerEntry = Parameters<Picker>[0][number];

export function applicationNetwork(): string {
  return (process.env.NEXT_PUBLIC_CANTON_NETWORK || "devnet").trim().toLowerCase();
}

export function configuredWalletGateway(): string | undefined {
  return process.env.NEXT_PUBLIC_CANTON_WALLET_GATEWAY_URL?.trim() || undefined;
}

// These published wallet releases have fixed network support. Unknown wallets
// remain discoverable; their actual status/accounts must pass verification.
export function compatibleWalletEntries(entries: PickerEntry[], network: string): PickerEntry[] {
  return entries.filter(entry => {
    const name = entry.name.replace(/\s+/g, "").toLowerCase();
    const send = entry.providerId === "browser:ext:ldmohiccoioolenadmogclhoklmanpgi" || name === "sendconnect";
    const grofty = entry.providerId === "browser:ext:ojlgdkgfbpkjceancgnniegbgadgmhig" || name === "grofty" || name === "groftywallet";
    if (network === "devnet" && send) return false;
    if (network !== "mainnet" && grofty) return false;
    return true;
  });
}
