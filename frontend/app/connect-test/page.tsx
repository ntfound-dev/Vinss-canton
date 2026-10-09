"use client";
import { useState } from "react";
import { CantonWalletConnect } from "@/components/CantonWalletConnect";
import { useWallet } from "@/components/workspace/WalletProvider";
import { loadCantonWalletSdk, verifiedWalletAccounts } from "@/lib/canton-wallet-config";
import { walletWait } from "@/lib/wallet-wait";

export default function ConnectTestPage() {
  const wallet = useWallet();
  const [result, setResult] = useState(""), [checking, setChecking] = useState(false);
  const network = process.env.NEXT_PUBLIC_CANTON_NETWORK || "devnet";
  const gatewayConfigured = Boolean(process.env.NEXT_PUBLIC_CANTON_WALLET_GATEWAY_URL?.trim());
  const wcConfigured = Boolean(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim());
  async function checkLedger() {
    setChecking(true); setResult("");
    try {
      await walletWait((async () => {
        await verifiedWalletAccounts();
        const response = await (await loadCantonWalletSdk()).ledgerApi({ requestMethod: "get", resource: "/v2/state/ledger-end" });
        const body = typeof response.response === "string" ? JSON.parse(response.response) : response;
        if (typeof body.offset !== "number" && typeof body.offset !== "string") throw new Error("Wallet did not return a ledger offset.");
        setResult(`Ledger read authorized. Current offset: ${body.offset}. No transaction was submitted.`);
      })(), 15000);
    } catch { setResult("Ledger read failed. Check wallet permissions, the validator connection, and gateway authentication/CORS. Reconnect and retry."); }
    finally { setChecking(false); }
  }
  return <section className="stack">
    <h1>Wallet connection check</h1>
    <p>Connect, approve access in your wallet, then confirm your Canton Party ID and ledger access.</p>
    <dl className="stack">
      <div>Application network: <strong>{network}</strong></div>
      <div>CIP-103 extension discovery: enabled</div>
      <div>Configured remote gateway: {gatewayConfigured ? "available in wallet picker" : "none; use a compatible extension or enter your provider’s HTTPS RPC endpoint"}</div>
      <div>WalletConnect: {wcConfigured ? "configured; choose a wallet supporting Canton dApp methods" : "not configured for this deployment"}</div>
      <div>Connection: {wallet.session ? "approved" : wallet.busy ? "waiting for wallet" : "disconnected"}</div>
    </dl>
    <CantonWalletConnect />
    {wallet.session && <>
      <p className="mono break-word">Party ID: {wallet.session.partyId}</p>
      <button className="ui-button" disabled={checking} onClick={() => void checkLedger()}>{checking ? "Checking…" : "Check ledger access"}</button>
    </>}
    {result && <p role="status">{result}</p>}
    <div className="ui-alert info">
      <p>Allow the wallet popup for this site. Finish or cancel its existing request before trying again.</p>
      <p>On Android, open VINSS in a full browser, not an embedded chat browser. Desktop extensions are not automatically available on mobile. Use a provider supporting Canton WalletConnect or a hosted CIP-103 gateway.</p>
      <p>A wallet name alone does not prove compatibility. It must authorize Canton accounts and the ledger/transaction methods used by VINSS. Never enter a seed phrase or access token here.</p>
    </div>
  </section>;
}
