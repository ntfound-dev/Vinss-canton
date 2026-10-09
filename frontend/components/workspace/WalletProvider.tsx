"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type * as sdk from "@canton-network/dapp-sdk";
import {
  loadActiveWalletSdk,
  verifiedWalletAccounts,
  selectWallet, restoreWalletSelection, rememberWalletSelection, forgetWalletSelection,
  type WalletKind,
} from "@/lib/canton-wallet-config";
import { walletErrorMessage } from "@/lib/grofty-wallet";
import { walletWait } from "@/lib/wallet-wait";
type Account = Awaited<ReturnType<typeof sdk.listAccounts>>[number];
export type WalletSession = { partyId: string; hint?: string };
interface Value {
  session: WalletSession | null;
  loading: boolean;
  busy: boolean;
  error: string;
  connect(kind?: WalletKind): Promise<void>;
  disconnect(): Promise<void>;
}
const Context = createContext<Value | null>(null);
export function primaryAccount(accounts: readonly Account[]) {
  return (
    accounts.find((a) => a.primary && !a.disabled && a.status === "allocated") ??
    accounts.find((a) => !a.disabled && a.status === "allocated")
  );
}
export function WalletProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<WalletSession | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pendingConnection = useRef<Promise<readonly Account[]> | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function apply(accounts: readonly Account[]) {
    const a = primaryAccount(accounts);
    setSession(
      a ? { partyId: a.partyId, ...(a.hint ? { hint: a.hint } : {}) } : null,
    );
  }
  useEffect(() => {
    let stopped = false;
    const changed = (accounts: readonly Account[]) => {
      if (!stopped) apply(accounts);
    };
    void (async () => {
      try {
        const accounts = await walletWait(
          (async () => {
            await restoreWalletSelection();
            const sdk = await loadActiveWalletSdk();
            return (await sdk.isConnected()).isConnected
              ? await verifiedWalletAccounts()
              : [];
          })(),
          8000,
        );
        if (!busyRef.current) changed(accounts);
      } catch (e) {
        // A failed session restore must not prevent a fresh connection attempt.
      } finally {
        if (!stopped) setLoading(false);
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);
  const connected = session !== null;
  useEffect(() => {
    if (!connected) return;
    let stopped = false;
    const changed = (_accounts: readonly Account[]) => {
      void verifiedWalletAccounts().then(accounts => { if (!stopped) { apply(accounts); setError(""); } }).catch(e => {
        if (!stopped) { setSession(null); setError(e instanceof Error ? e.message : String(e)); }
      });
    };
    let subscribedSdk: Awaited<ReturnType<typeof loadActiveWalletSdk>> | undefined;
    const statusChanged = (status: sdk.StatusEvent) => {
      if (!status.connection.isConnected) { if (!stopped) setSession(null); }
      else changed([]);
    };
    void loadActiveWalletSdk()
      .then((sdk) => {
        if (!stopped) {
          subscribedSdk = sdk;
          return Promise.all([sdk.onAccountsChanged(changed), sdk.onStatusChanged(statusChanged)]);
        }
      })
      .catch((e) => {
        if (!stopped) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      stopped = true;
      if (subscribedSdk) void Promise.all([subscribedSdk.removeOnAccountsChanged(changed), subscribedSdk.removeOnStatusChanged(statusChanged)]).catch(() => {});
    };
  }, [connected]);
  async function connect(kind: WalletKind = "canton") {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      if (!pendingConnection.current) {
        const pending = (async () => {
          await selectWallet(kind);
          const sdk = await loadActiveWalletSdk();
          // Explicit gateway selection must open that gateway even when the SDK
          // previously restored a browser-extension session.
          if ((kind === "gateway" || !(await sdk.isConnected()).isConnected) &&
            !(await sdk.connect()).isConnected)
            throw new Error(
              "Connection cancelled. Choose a wallet to try again.",
            );
          const accounts = await verifiedWalletAccounts();
          if (!primaryAccount(accounts))
            throw new Error(
              "No active Canton account found. Choose an account in your wallet.",
            );
          rememberWalletSelection();
          return accounts;
        })();
        pendingConnection.current = pending;
        void pending
          .then(
            (accounts) => {
              if (mounted.current) {
                apply(accounts);
                setError("");
              }
            },
            () => {},
          )
          .finally(() => {
            if (pendingConnection.current === pending)
              pendingConnection.current = null;
          });
      }
      const accounts = await walletWait(pendingConnection.current, 60000);
      if (mounted.current) apply(accounts);
    } catch (e) {
      if (mounted.current) {
        const message = walletErrorMessage(e);
        setError(
          /failed to fetch|networkerror/i.test(message)
            ? "Could not reach the selected wallet. Check its connection, then try again."
            : message,
        );
      }
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function disconnect() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await walletWait((await loadActiveWalletSdk()).disconnect(), 10000);
      forgetWalletSelection();
      setSession(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Context.Provider
      value={{ session, loading, busy, error, connect, disconnect }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWallet() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing WalletProvider");
  return value;
}
