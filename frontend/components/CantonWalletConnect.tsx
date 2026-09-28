"use client";

import { useState } from "react";
import * as cantonSdk from "@canton-network/dapp-sdk";

export type CantonWalletSession = {
  partyId: string;
  hint?: string;
};

interface Props {
  onConnected?(session: CantonWalletSession): void;
}

export function CantonWalletConnect({ onConnected }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<CantonWalletSession | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);

    try {
      const result = await cantonSdk.connect();

      if (!result?.isConnected) {
        throw new Error("Wallet connection was cancelled or failed");
      }

      const accounts = await cantonSdk.listAccounts();
      const primary =
        (accounts as { primary?: boolean; partyId?: string; hint?: string }[] | undefined)?.find(
          (a) => a.primary,
        ) ?? (accounts as { partyId?: string; hint?: string }[] | undefined)?.[0];

      if (!primary?.partyId) {
        throw new Error("No Canton party returned from wallet");
      }

      const next: CantonWalletSession = {
        partyId: primary.partyId,
        hint: primary.hint,
      };

      setSession(next);
      onConnected?.(next);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Connect failed";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    try {
      await cantonSdk.disconnect();
    } catch {
      // ignore
    }
    setSession(null);
  }

  if (session) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-signal/20 bg-signal/[0.05] px-3 py-2">
        <span className="text-[9px] uppercase tracking-[0.12em] text-signal/70">
          Connected
        </span>
        <span className="max-w-[240px] truncate text-[11px] text-paper/75">
          {session.hint ? `${session.hint} · ` : ""}
          {session.partyId}
        </span>
        <button
          type="button"
          onClick={() => void disconnect()}
          className="h-8 rounded-lg border border-wire/60 px-2 text-[8px] uppercase tracking-[0.12em] text-paper/45"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void connect()}
        className="h-10 rounded-xl border border-signal/35 bg-signal/[0.08] px-4 text-[10px] uppercase tracking-[0.14em] text-signal disabled:opacity-40"
      >
        {busy ? "Connecting…" : "Connect Canton Wallet"}
      </button>
      {error && <p className="text-[10px] text-danger/80">{error}</p>}
    </div>
  );
}
