"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useWallet, type WalletSession } from "./workspace/WalletProvider";
import { Icon } from "./workspace/Icon";
import { shortId } from "@/lib/workspace";
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
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
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
          if (!wallet.busy) setChoosing(false);
        }}
        onClick={(event) => {
          if (!wallet.busy && event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right ||
                event.clientY < bounds.top || event.clientY > bounds.bottom) setChoosing(false);
          }
        }}
      >
        <div className="wallet-dialog-header">
          <h2 id={titleId}>Connect wallet</h2>
          <button type="button" className="ui-button wallet-dialog-close" aria-label="Close wallet selection" disabled={wallet.busy} onClick={() => setChoosing(false)}>×</button>
        </div>
        <p className="wallet-dialog-description">Choose your wallet to continue.</p>
        <button type="button" className="ui-button primary wallet-choice" disabled={wallet.busy || wallet.loading} onClick={() => void wallet.connect("grofty")}>
          <Icon name="wallet" /><span>Grofty</span><span className="wallet-choice-arrow" aria-hidden="true">→</span>
        </button>
        <button type="button" className="ui-button wallet-choice" disabled={wallet.busy || wallet.loading} onClick={() => void wallet.connect("canton")}>
          <Icon name="wallet" /><span>Other Canton wallets</span><span className="wallet-choice-arrow" aria-hidden="true">→</span>
        </button>
        <p className="wallet-dialog-description" role="status">{wallet.busy ? "Waiting for wallet approval…" : "Approve the connection in your wallet."}</p>
        {wallet.error && <div className="wallet-dialog-error"><p role="alert">{wallet.error}</p><a href="/connect-test">Connection help</a></div>}
      </dialog>
    </>
  );
}
