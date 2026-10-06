"use client";
import Link from "next/link";
import { Icon } from "./Icon";
import { useWallet } from "./WalletProvider";
export function EmptyWorkspace({
  kind,
  compact = false,
}: {
  kind: "rooms" | "deals";
  compact?: boolean;
}) {
  const wallet = useWallet(),
    rooms = kind === "rooms";
  return (
    <div className={"workspace-empty " + (compact ? "compact" : "full")}>
      <div
        className={"empty-art " + (rooms ? "art-chat" : "art-escrow")}
        aria-hidden="true"
      >
        <span className="art-tile back">
          <Icon name={rooms ? "file" : "wallet"} />
        </span>
        <span className="art-tile front">
          <Icon name={rooms ? "chat" : "shield"} />
        </span>
        <span className="art-dot" />
      </div>
      <div className="empty-copy">
        <h3>{rooms ? "Your private inbox" : "No deals yet"}</h3>
        <p>
          {rooms
            ? wallet.session
              ? "Invite someone to start your first conversation."
              : "Connect your wallet to view your rooms."
            : wallet.session
              ? "Create an offer in a room to track its payment here."
              : "Connect your wallet to view offers and payments."}
        </p>
        {wallet.session ? (
          <Link className="text-link" href="/invite/new">
            {rooms ? "Create invite" : "Start a deal"}
            <Icon name="arrow" />
          </Link>
        ) : (
          <button
            type="button"
            className="text-link empty-connect"
            disabled={wallet.busy || wallet.loading}
            onClick={() => void wallet.connect()}
          >
            {wallet.busy ? "Waiting for wallet…" : "Connect wallet"}
            <Icon name="arrow" />
          </button>
        )}
      </div>
      {!compact && (
        <div className="empty-tips">
          <div>
            <Icon name={rooms ? "link" : "file"} />
            <h4>{rooms ? "Invite by link" : "Agree on an offer"}</h4>
            <p>
              {rooms
                ? "Share one link. Your guest connects a wallet and joins."
                : "Confirm the scope, amount, and delivery terms in your room."}
            </p>
          </div>
          <div>
            <Icon name="shield" />
            <h4>{rooms ? "Discuss in private" : "Track escrow"}</h4>
            <p>
              {rooms
                ? "Messages and offer details are encrypted with OpenMLS."
                : "Follow funding, delivery approval, and Canton settlement."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
export function WorkspaceLoading() {
  return (
    <div
      className="workspace-skeleton surface"
      role="status"
      aria-label="Loading your workspace"
    >
      <div className="skeleton-line wide" />
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
      <span className="sr-only">Loading your workspace…</span>
    </div>
  );
}
