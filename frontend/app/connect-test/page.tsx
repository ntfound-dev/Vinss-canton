"use client";
import { useState } from "react";
import { CantonWalletConnect } from "@/components/CantonWalletConnect";
import { useWallet } from "@/components/workspace/WalletProvider";
import { loadActiveWalletSdk, verifiedWalletAccounts } from "@/lib/canton-wallet-config";
import { walletErrorMessage } from "@/lib/grofty-wallet";
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
        const response = await (await loadActiveWalletSdk()).ledgerApi({ requestMethod: "get", resource: "/v2/state/ledger-end" });
        const body = response && typeof response === "object" && "response" in response && typeof response.response === "string" ? JSON.parse(response.response) : response;
        if (!body || typeof body !== "object" || !("offset" in body)) throw new Error("Wallet did not return a ledger offset.");
        if (typeof body.offset !== "number" && typeof body.offset !== "string") throw new Error("Wallet did not return a ledger offset.");
        setResult(`Ledger read authorized. Current offset: ${body.offset}. No transaction was submitted.`);
      })(), 15000);
    } catch (error) { setResult(`Ledger read failed: ${walletErrorMessage(error)}`); }
    finally { setChecking(false); }
  }
  return <section className="stack">
    <h1>Wallet connection check</h1>
    <p>Connect, approve access in your wallet, then confirm your Canton Party ID and ledger access.</p>
    <dl className="stack">
      <div>Application network: <strong>{network}</strong></div>
      <div>Grofty SDK: 0.2.0 — direct provider discovery, Wallet 2.0.4+ required, MainNet only</div>
      <div>CIP-103 extension discovery: enabled</div>
      <div>Configured remote gateway: {gatewayConfigured ? "available via the dedicated wallet gateway option" : "missing; a network-compatible wallet or CIP-103 gateway is required"}</div>
      <div>WalletConnect: {wcConfigured ? "configured; choose a wallet supporting Canton dApp methods" : "not configured for this deployment"}</div>
      <div>Connection: {wallet.session ? "approved" : wallet.busy ? "waiting for wallet" : "disconnected"}</div>
    </dl>
    <CantonWalletConnect />
    {network === "devnet" && <div className="ui-alert info">
      <p><strong>DevNet connection setup</strong></p>
      <p>Send Connect supports MainNet/TestNet; Grofty supports MainNet. They cannot authorize this DevNet deployment.</p>
      {!gatewayConfigured && <p>The operator must supply a DevNet CIP-103 Wallet Gateway and configure <code>NEXT_PUBLIC_CANTON_WALLET_GATEWAY_URL</code> in Vercel Production, then redeploy. VINSS will open that gateway for wallet approval.</p>}
      <p>The HackCanton NODERS web wallet and JSON Ledger API are separate services. Do not paste either URL into the custom wallet field unless the operator confirms a CIP-103 endpoint. Logging into the web wallet alone does not connect it to VINSS.</p>
      <p><a href="https://wallet.validator.hackcanton-01.devnet.naas.noders.services" target="_blank" rel="noopener noreferrer">Open HackCanton DevNet wallet</a> to check your sandbox account. This link does not connect or submit transactions.</p>
    </div>}
    {wallet.session && <>
      <p className="mono break-word">Party ID: {wallet.session.partyId}</p>
      <button className="ui-button" disabled={checking} onClick={() => void checkLedger()}>{checking ? "Checking…" : "Check ledger access"}</button>
    </>}
    {result && <p role="status">{result}</p>}
    <div className="ui-alert info">
      <p>Allow the wallet popup for this site. Finish or cancel its existing request before trying again.</p>
      <p>On Android, open VINSS in a full browser, not an embedded chat browser. Grofty’s Android app does not automatically connect to Chrome Android; the official SDK documents injected provider discovery, without a Chrome Android pairing transport. Use a provider supporting Canton WalletConnect or a hosted CIP-103 gateway.</p>
      <p>A wallet name alone does not prove compatibility. It must authorize Canton accounts and the ledger/transaction methods used by VINSS. Never enter a seed phrase or access token here.</p>
    </div>
  </section>;
}
