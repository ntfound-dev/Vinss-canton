"use client";
import { useId, useState } from "react";
import { loginDevNet, selectDevNetParty, type DevNetAccount } from "@/lib/devnet-wallet";
import { useWallet } from "./workspace/WalletProvider";

export function DevNetLogin({ onBusy }: { onBusy(busy: boolean): void }) {
  const wallet = useWallet();
  const id = useId();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [tokenMode, setTokenMode] = useState(false);
  const [account, setAccount] = useState<DevNetAccount>();
  const [party, setParty] = useState("");
  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget, data = new FormData(form);
    setBusy(true); onBusy(true); setError("");
    try {
      const result = await loginDevNet(tokenMode ? { accessToken: String(data.get("token") || "") } : {
        username: String(data.get("username") || ""), password: String(data.get("password") || ""), totp: String(data.get("totp") || ""),
      });
      form.reset(); // Never retain a password/token in React state or local storage.
      if (result.parties.length > 1) { setAccount(result); setParty(result.partyId); }
      else await wallet.connect("devnet");
    } catch (e) { setError(e instanceof Error ? e.message : "DevNet sign-in failed."); }
    finally { form.reset(); setBusy(false); onBusy(false); }
  }
  async function finish() {
    setBusy(true); onBusy(true); setError("");
    try { await selectDevNetParty(party); await wallet.connect("devnet"); }
    catch (e) { setError(e instanceof Error ? e.message : "Party selection failed."); }
    finally { setBusy(false); onBusy(false); }
  }
  return <div className="stack devnet-login">
    <p className="wallet-dialog-description">Use your HackCanton account. This sandbox uses the NODERS hosted Party.</p>
    {account ? <>
      <label className="field" htmlFor={id + "party"}>Choose your Party
        <select id={id + "party"} value={party} onChange={event => setParty(event.target.value)} disabled={busy}>
          {account.parties.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <button className="ui-button primary" disabled={busy || wallet.busy} onClick={() => void finish()}>Continue with this Party</button>
    </> : <form className="stack" onSubmit={event => void signIn(event)}>
      {tokenMode ? <label className="field" htmlFor={id + "token"}>Your DevNet access token
        <textarea id={id + "token"} name="token" required autoComplete="off" spellCheck={false} rows={3} disabled={busy} />
      </label> : <>
        <label className="field" htmlFor={id + "email"}>HackCanton email
          <input id={id + "email"} name="username" type="email" autoComplete="username" required disabled={busy} />
        </label>
        <label className="field" htmlFor={id + "password"}>Password
          <input id={id + "password"} name="password" type="password" autoComplete="current-password" required disabled={busy} />
        </label>
        <details><summary>Two-factor code</summary><label className="field" htmlFor={id + "otp"}>Code (if enabled)<input id={id + "otp"} name="totp" inputMode="numeric" autoComplete="one-time-code" disabled={busy} /></label></details>
      </>}
      <button type="submit" className="ui-button primary" disabled={busy || wallet.busy}>{busy ? "Signing in…" : "Sign in to DevNet"}</button>
      <button type="button" className="ui-button" disabled={busy} onClick={() => setTokenMode(!tokenMode)}>{tokenMode ? "Use email and password" : "Use my own access token"}</button>
    </form>}
    {error && <div className="wallet-dialog-error"><p role="alert">{error}</p><a href="/connect-test">Connection help</a></div>}
  </div>;
}
