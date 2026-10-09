"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useWallet, type WalletSession } from "./workspace/WalletProvider";
import { Icon } from "./workspace/Icon";
import { shortId } from "@/lib/workspace";
import { applicationNetwork, configuredWalletGateway } from "@/lib/canton-wallet-policy";
import { DevNetLogin } from "./DevNetLogin";
import { selectedWalletKind } from "@/lib/canton-wallet-config";
import { devNetWallet, selectDevNetParty } from "@/lib/devnet-wallet";
export type CantonWalletSession = WalletSession;
export function CantonWalletConnect({
  onConnected,
  onDisconnected,
}: {
  onConnected?(session: WalletSession): void;
  onDisconnected?(): void;
}) {
  const wallet = useWallet();
  const [choosing, setChoosing] = useState(false);
  const [devnetLogin, setDevnetLogin] = useState(false), [loginBusy, setLoginBusy] = useState(false), [partyError, setPartyError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const network = applicationNetwork();
  const gatewayAvailable = Boolean(configuredWalletGateway());
  useEffect(() => {
    if (wallet.session) setChoosing(false);
    const element = dialog.current;
    if (!element || !choosing || wallet.session) return;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, [choosing, wallet.session]);
  useEffect(() => {
    if (wallet.loading) return;
    if (wallet.session) onConnected?.(wallet.session);
    else onDisconnected?.();
  }, [wallet.session, wallet.loading, onConnected, onDisconnected]);
  if (wallet.session)
    return (
      <details className="wallet-menu">
        <summary className="ui-button">
          <span className="status-dot" />
          {wallet.session.hint || shortId(wallet.session.partyId)}
        </summary>
        <div className="wallet-popover">
          <p className="eyebrow">Canton account</p>
          <p className="mono break-word">{wallet.session.partyId}</p>
          {selectedWalletKind() === "devnet" && devNetWallet.availableParties().length > 1 && <label className="field">Active DevNet Party
            <select value={wallet.session.partyId} disabled={wallet.busy || loginBusy} onChange={event => {
              setLoginBusy(true); setPartyError("");
              void selectDevNetParty(event.target.value).catch(e => setPartyError(e instanceof Error ? e.message : "Party selection failed.")).finally(() => setLoginBusy(false));
            }}>{devNetWallet.availableParties().map(party => <option key={party} value={party}>{party}</option>)}</select>
          </label>}
          {partyError && <p role="alert">{partyError}</p>}
          <button
            className="ui-button"
            disabled={wallet.busy}
            onClick={() => void wallet.disconnect()}
          >
            {wallet.busy ? "Disconnecting…" : "Disconnect wallet"}
          </button>
        </div>
      </details>
    );
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={choosing}
        className="ui-button primary"
        disabled={wallet.busy || wallet.loading}
        onClick={() => setChoosing(true)}
      >
        {wallet.busy || wallet.loading ? <span className="ui-spinner" /> : <Icon name="wallet" />}
        {wallet.busy ? "Waiting for wallet…" : wallet.loading ? "Loading…" : "Connect wallet"}
      </button>
      <dialog
        ref={dialog}
        className="wallet-dialog"
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          if (!wallet.busy && !loginBusy) setChoosing(false);
        }}
        onClick={(event) => {
          if (!wallet.busy && !loginBusy && event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right ||
                event.clientY < bounds.top || event.clientY > bounds.bottom) setChoosing(false);
          }
        }}
      >
        <div className="wallet-dialog-header">
          <h2 id={titleId}>{network === "devnet" && devnetLogin ? "HackCanton DevNet" : "Connect wallet"}</h2>
          <button type="button" className="ui-button wallet-dialog-close" aria-label="Close wallet selection" disabled={wallet.busy || loginBusy} onClick={() => setChoosing(false)}>×</button>
        </div>
        {network === "devnet" && devnetLogin && choosing ? <><DevNetLogin onBusy={setLoginBusy} /><button className="ui-button" disabled={wallet.busy || loginBusy} onClick={() => setDevnetLogin(false)}>Other connection options</button></> : <>
        <p className="wallet-dialog-description">Connect a wallet on Canton {network === "devnet" ? "DevNet" : network === "testnet" ? "TestNet" : "MainNet"}.</p>
        {network === "devnet" && <button type="button" className="ui-button primary wallet-choice" onClick={() => setDevnetLogin(true)}><Icon name="wallet" /><span>HackCanton DevNet</span><span className="wallet-choice-arrow" aria-hidden="true">→</span></button>}
        {gatewayAvailable && <>
          <button type="button" className="ui-button primary wallet-choice" disabled={wallet.busy || wallet.loading || !gatewayAvailable} onClick={() => void wallet.connect("gateway")}>
            <Icon name="wallet" /><span>Wallet gateway</span><span className="wallet-choice-arrow" aria-hidden="true">→</span>
          </button>
        </>}
        <button type="button" className="ui-button wallet-choice" disabled={wallet.busy || wallet.loading || network !== "mainnet"} onClick={() => void wallet.connect("grofty")}>
          <Icon name="wallet" /><span>Grofty{network !== "mainnet" ? " · MainNet only" : ""}</span><span className="wallet-choice-arrow" aria-hidden="true">→</span>
        </button>
        <button type="button" className="ui-button wallet-choice" disabled={wallet.busy || wallet.loading} onClick={() => void wallet.connect("canton")}>
          <Icon name="wallet" /><span>{network === "devnet" ? "Other DevNet wallets" : "Other Canton wallets"}</span><span className="wallet-choice-arrow" aria-hidden="true">→</span>
        </button>
        <p className="wallet-dialog-description" role="status">{wallet.busy ? "Waiting for wallet approval…" : "Approve the connection in your wallet."}</p>
        </>}
        {wallet.error && <div className="wallet-dialog-error"><p role="alert">{wallet.error}</p><a href="/connect-test">Connection help</a></div>}
      </dialog>
    </>
  );
}
