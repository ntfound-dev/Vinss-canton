"use client";
import { useEffect } from "react";
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
    <button
      type="button"
      className="ui-button primary"
      disabled={wallet.busy || wallet.loading}
      onClick={() => void wallet.connect()}
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
