"use client";
import { useEffect, useState } from "react";
import { CantonWalletConnect } from "@/components/CantonWalletConnect";
import { useWallet } from "@/components/workspace/WalletProvider";
import { loadActiveWalletSdk, verifiedWalletAccounts } from "@/lib/canton-wallet-config";
import { walletErrorMessage } from "@/lib/grofty-wallet";
import { walletWait } from "@/lib/wallet-wait";
import { devNetRequest } from "@/lib/devnet-wallet";

export default function ConnectTestPage() {
  const wallet = useWallet();
  const [result, setResult] = useState(""), [checking, setChecking] = useState(false);
  const network = process.env.NEXT_PUBLIC_CANTON_NETWORK || "devnet";
  const gatewayConfigured = Boolean(process.env.NEXT_PUBLIC_CANTON_WALLET_GATEWAY_URL?.trim());
  const wcConfigured = Boolean(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim());
  const [devnetSetup, setDevnetSetup] = useState("checking");
  useEffect(() => {
    if (network !== "devnet") return;
    void devNetRequest<{ configured?: boolean; authenticated?: boolean }>().then(value => setDevnetSetup(value.authenticated || value.configured ? "available" : "server session key missing")).catch(() => setDevnetSetup("service unavailable"));
  }, [network]);
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
      {network === "devnet" && <div>HackCanton sandbox login: {devnetSetup}</div>}
      <div>Configured remote gateway: {gatewayConfigured ? "available via the dedicated wallet gateway option" : "not configured (separate from sandbox login)"}</div>
      <div>WalletConnect: {wcConfigured ? "configured; choose a wallet supporting Canton dApp methods" : "not configured for this deployment"}</div>
      <div>Connection: {wallet.session ? "approved" : wallet.busy ? "waiting for wallet" : "disconnected"}</div>
    </dl>
    <CantonWalletConnect />
    {network === "devnet" && <div className="ui-alert info">
      <p><strong>DevNet connection setup</strong></p>
      <p>Send Connect supports MainNet/TestNet; Grofty supports MainNet. They cannot authorize this DevNet deployment.</p>
      <p>Choose <strong>HackCanton DevNet</strong> and sign in with your HackCanton account. VINSS verifies your ledger user and CanActAs Parties. Every transaction needs explicit approval in VINSS. This is a NODERS hosted sandbox Party, not an externally signing wallet.</p>
      <p>If the session key is missing, configure the server-only <code>VINSS_DEVNET_SESSION_SECRET</code> (64 random hex characters) in Vercel Production and redeploy. A CIP-103 gateway is optional for the separate wallet route.</p>
      <p>If the node rejects password login, use only your own fresh access token in the dedicated DevNet sign-in form, or ask the operator to confirm the permitted client ID. Never enter a seed phrase. The JSON Ledger API URL must not be pasted into the SDK wallet picker.</p>
      <p><a href="https://wallet.validator.hackcanton-01.devnet.naas.noders.services" target="_blank" rel="noopener noreferrer">Open HackCanton DevNet wallet</a> to check your sandbox account. This link does not connect or submit transactions.</p>
    </div>}
    {wallet.session && <>
      <p className="mono break-word">Party ID: {wallet.session.partyId}</p>
      <button className="ui-button" disabled={checking} onClick={() => void checkLedger()}>{checking ? "Checking…" : "Check ledger access"}</button>
    </>}
    {result && <p role="status">{result}</p>}
    <div className="ui-alert info">
      <p>Allow the wallet popup for this site. Finish or cancel its existing request before trying again.</p>
      <p>On Android, HackCanton DevNet login works through the web form without an extension. Its actual account login still needs user verification. Open VINSS in a full browser. Grofty’s Android app does not automatically connect to Chrome Android.</p>
      <p>A wallet name alone does not prove compatibility. It must authorize Canton accounts and the ledger/transaction methods used by VINSS. Never enter a seed phrase or paste tokens into diagnostic results.</p>
    </div>
  </section>;
}
