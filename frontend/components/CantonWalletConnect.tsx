"use client";

import {
  useEffect,
  useState,
} from "react";

import * as cantonSdk
  from "@canton-network/dapp-sdk";

import {
  initCantonWalletSdk,
} from "@/lib/canton-wallet-config";

export type CantonWalletSession = {
  partyId: string;
  hint?: string;
};

interface Props {
  onConnected?(
    session:
      CantonWalletSession,
  ): void;

  onDisconnected?():
    void;
}

type WalletAccount =
  Awaited<
    ReturnType<
      typeof cantonSdk.listAccounts
    >
  >[number];

export function CantonWalletConnect({
  onConnected,
  onDisconnected,
}: Props) {
  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState<
      string |
      null
    >(null);

  const [session, setSession] =
    useState<
      CantonWalletSession |
      null
    >(null);

  useEffect(
    () => {
      let disposed =
        false;

      const applyAccounts =
        (
          accounts:
            readonly WalletAccount[],
        ) => {
          if (disposed) {
            return;
          }

          const primary =
            selectPrimaryAccount(
              accounts,
            );

          if (!primary) {
            setSession(
              null,
            );

            onDisconnected?.();

            return;
          }

          const next:
            CantonWalletSession = {
            partyId:
              primary.partyId,

            ...(primary.hint
              ? {
                  hint:
                    primary.hint,
                }
              : {}),
          };

          setSession(
            next,
          );

          onConnected?.(
            next,
          );
        };

      const restore =
        async () => {
          try {
            await initCantonWalletSdk();

            const connection =
              await cantonSdk
                .isConnected();

            if (
              !connection
                .isConnected
            ) {
              return;
            }

            applyAccounts(
              await cantonSdk
                .listAccounts(),
            );
          } catch (
            cause
          ) {
            if (!disposed) {
              setError(
                errorText(
                  cause,
                ),
              );
            }
          }
        };

      void restore();

      void cantonSdk
        .onAccountsChanged(
          applyAccounts,
        );

      return () => {
        disposed =
          true;

        void cantonSdk
          .removeOnAccountsChanged(
            applyAccounts,
          );
      };
    },
    [],
  );

  async function connect() {
    setBusy(true);
    setError(null);

    try {
      await initCantonWalletSdk();

      const result =
        await cantonSdk
          .connect();

      if (
        !result
          .isConnected
      ) {
        throw new Error(
          "Wallet connection was cancelled or failed",
        );
      }

      const accounts =
        await cantonSdk
          .listAccounts();

      const primary =
        selectPrimaryAccount(
          accounts,
        );

      if (!primary) {
        throw new Error(
          "No usable Canton Party returned from wallet",
        );
      }

      const next:
        CantonWalletSession = {
        partyId:
          primary.partyId,

        ...(primary.hint
          ? {
              hint:
                primary.hint,
            }
          : {}),
      };

      setSession(
        next,
      );

      onConnected?.(
        next,
      );
    } catch (
      cause
    ) {
      setError(
        errorText(
          cause,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);

    try {
      await cantonSdk
        .disconnect();
    } catch (
      cause
    ) {
      setError(
        errorText(
          cause,
        ),
      );
    } finally {
      setSession(
        null,
      );

      onDisconnected?.();

      setBusy(false);
    }
  }

  if (session) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-signal/20 bg-signal/[0.05] px-3 py-2">
        <span className="text-[9px] uppercase tracking-[0.12em] text-signal/70">
          Canton wallet
        </span>

        <span className="max-w-[240px] truncate text-[11px] text-paper/75">
          {session.hint
            ? `${session.hint} · `
            : ""}
          {session.partyId}
        </span>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void disconnect()
          }
          className="h-8 rounded-lg border border-wire/60 px-2 text-[8px] uppercase tracking-[0.12em] text-paper/45 disabled:opacity-40"
        >
          {busy
            ? "Disconnecting…"
            : "Disconnect"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void connect()
        }
        className="h-10 rounded-xl border border-signal/35 bg-signal/[0.08] px-4 text-[10px] uppercase tracking-[0.14em] text-signal disabled:opacity-40"
      >
        {busy
          ? "Connecting…"
          : "Connect Canton Wallet"}
      </button>

      {error && (
        <p className="text-[10px] text-danger/80">
          {error}
        </p>
      )}
    </div>
  );
}

function selectPrimaryAccount(
  accounts:
    readonly WalletAccount[],
):
  | WalletAccount
  | undefined {
  return (
    accounts.find(
      (account) =>
        account.primary &&
        isUsableAccount(
          account,
        ),
    ) ??
    accounts.find(
      isUsableAccount,
    )
  );
}

function isUsableAccount(
  account:
    WalletAccount,
): boolean {
  return (
    account.status !==
      "removed" &&
    account.disabled !==
      true
  );
}

function errorText(
  value:
    unknown,
): string {
  return value instanceof Error
    ? value.message
    : String(value);
}
