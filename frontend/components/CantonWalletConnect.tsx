"use client";
import { useEffect, useState } from "react";
import { useWallet, type WalletSession } from "./workspace/WalletProvider";
import { Icon } from "./workspace/Icon";
import { GROFTY_EXTENSION_URL, GROFTY_ANDROID_URL } from "@/lib/grofty-wallet";
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
  if (choosing) return <div className="wallet-menu"><button className="ui-button" disabled={wallet.busy} onClick={() => setChoosing(false)} aria-expanded="true">Choose wallet</button><div className="wallet-popover" role="group" aria-label="Choose Canton wallet">
    <p className="eyebrow">Choose your wallet</p>
    <button className="ui-button primary" disabled={wallet.busy || wallet.loading} onClick={() => void wallet.connect("grofty")}>Connect Grofty</button>
    <p>Grofty Wallet 2.0.4+ · MainNet only. Approve access in your wallet.</p>
    <p>Chrome Android cannot use the desktop extension. The SDK requires a wallet provider in this browser.</p>
    <p><a href={GROFTY_EXTENSION_URL} target="_blank" rel="noopener noreferrer">Desktop extension</a> · <a href={GROFTY_ANDROID_URL} target="_blank" rel="noopener noreferrer">Android app</a></p>
    <button className="ui-button" disabled={wallet.busy || wallet.loading} onClick={() => void wallet.connect("canton")}>Other Canton wallet / gateway</button>
    {wallet.error && <p role="alert">{wallet.error}</p>}
    <button className="ui-button" disabled={wallet.busy} onClick={() => setChoosing(false)}>Close</button>
  </div></div>;
  return (
    <button
      type="button"
      aria-expanded="false"
      className="ui-button primary"
      disabled={wallet.busy || wallet.loading}
      onClick={() => setChoosing(true)}
    >
      {wallet.busy || wallet.loading ? (
        <span className="ui-spinner" />
      ) : (
        <Icon name="wallet" />
      )}
      {wallet.busy
        ? "Open wallet…"
        : wallet.loading
          ? "Loading…"
          : "Connect wallet"}
    </button>
  );
}
