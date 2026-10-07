"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "./WalletProvider";
import { Icon } from "./Icon";
import { CantonDappLedgerClient } from "@/lib/canton-dapp-ledger-client";
import {
  decodeInvite,
  encodeInvite,
  makeInvite,
  registerInvite,
  resolveInvite,
  saveInvite,
  groupBookmark,
  type PrivateInvite,
} from "@/lib/canton-invite";
import { InviteQr } from "./InviteQr";
import { rememberRoom, roomUrl, shortId } from "@/lib/workspace";
export function InvitePanel({ creating = false }: { creating?: boolean }) {
  const router = useRouter(),
    { session, connect, busy: walletBusy } = useWallet();
  const [kind, setKind] = useState<"private" | "group">("private");
  const [invite, setInvite] = useState<PrivateInvite | null>(null),
    [title, setTitle] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false),
    [url, setUrl] = useState("");
  useEffect(() => {
    if (creating) return;
    try {
      const token = location.hash.slice(1);
      if (!token)
        throw new Error("Open the complete invite link you received.");
      setInvite(decodeInvite(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [creating]);
  const owner = Boolean(session && invite?.host === session.partyId);
  const group = invite?.kind === "group" || (!invite && kind === "group");
  useEffect(() => {
    if (invite) setUrl(`${location.origin}/invite#${encodeInvite(invite)}`);
  }, [invite]);
  useEffect(() => {
    if (!invite || !session || !owner || invite.kind === "group") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const ledger = await CantonDappLedgerClient.connect(session!.partyId);
        const room = await resolveInvite(ledger, invite!, session!.partyId);
        if (stopped) return;
        if (room) {
          rememberRoom(session!.partyId, room);
          router.replace(roomUrl(room));
          return;
        }
        setError("");
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : String(e));
      }
      if (!stopped) timer = setTimeout(() => void poll(), 5000);
    }
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [invite, session?.partyId, owner, router]);
  async function create() {
    if (!session) return;
    try {
      const next = makeInvite(
        session.partyId,
        title,
        kind === "group" ? "group" : undefined,
      );
      saveInvite(next);
      if (next.kind === "group")
        rememberRoom(session.partyId, groupBookmark(next, true));
      setInvite(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function join() {
    if (!session || !invite || busy) return;
    setBusy(true);
    setError("");
    try {
      const ledger = await CantonDappLedgerClient.connect(session.partyId);
      const room = await registerInvite(ledger, invite, session.partyId);
      rememberRoom(session.partyId, room);
      router.push(roomUrl(room));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(
        "Copy is unavailable in this browser. Select the link below and copy it.",
      );
    }
  }
  return (
    <div className="narrow">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {invite?.kind === "group" || (!invite && kind === "group")
              ? "GROUP INVITE"
              : "PRIVATE INVITE"}
          </p>
          <h1 style={{ marginTop: 10 }}>
            {owner
              ? "Invite link ready."
              : creating
                ? kind === "group"
                  ? "Invite your group."
                  : "Start a private deal."
                : "You’re invited."}
          </h1>
        </div>
        <Link className="text-link" href="/">
          Back home
        </Link>
      </div>
      <div className="surface padded stack">
        {error && (
          <div className="ui-alert error" role="alert">
            {error}
          </div>
        )}
        {!invite && creating && (
          <>
            <p className="muted">
              {kind === "group"
                ? "Create one link for your group. Each guest connects a Canton wallet to join the encrypted conversation."
                : "Create a link for your client or freelancer. Chat and agree on an offer in one private room."}
            </p>
            <fieldset className="invite-kind">
              <legend>Conversation type</legend>
              <label>
                <input
                  type="radio"
                  name="invite-kind"
                  checked={kind === "private"}
                  onChange={() => setKind("private")}
                />
                <span>
                  <strong>Private deal</strong>
                  <small>Two people · chat, offer, escrow</small>
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  name="invite-kind"
                  checked={kind === "group"}
                  onChange={() => setKind("group")}
                />
                <span>
                  <strong>Group chat</strong>
                  <small>Multiple people · encrypted messages</small>
                </span>
              </label>
            </fieldset>
            <label className="field">
              Conversation name{" "}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="e.g. Design project"
              />
              <small>Optional. This name is included in the shared link.</small>
            </label>
          </>
        )}
        {invite && (
          <>
            <div className="section-heading">
              <h2>{invite.title}</h2>
              <span className="badge green">Canton {invite.network}</span>
            </div>
            <p className="muted">
              {owner
                ? invite.kind === "group"
                  ? "Share this link or QR with your group. Open the group to admit guests automatically."
                  : "Share this link or QR with one person. This page opens your room when they join."
                : invite.kind === "group"
                  ? "Connect your Canton wallet to join this encrypted group."
                  : "Connect your Canton wallet to join this private conversation."}
            </p>
          </>
        )}
        {!session ? (
          <button
            className="ui-button primary"
            disabled={walletBusy}
            onClick={() => void connect()}
          >
            <Icon name="wallet" />
            {walletBusy ? "Connecting…" : "Connect Canton wallet"}
          </button>
        ) : !invite && creating ? (
          <button className="ui-button primary" onClick={() => void create()}>
            <Icon name="link" />
            {kind === "group" ? "Create group invite" : "Create private invite"}
          </button>
        ) : invite && !owner ? (
          <button
            className="ui-button primary"
            disabled={busy}
            onClick={() => void join()}
          >
            <Icon name="chat" />
            {busy
              ? "Preparing your room…"
              : invite.kind === "group"
                ? "Join group"
                : "Join private room"}
          </button>
        ) : null}
        {owner && (
          <>
            <label className="field">
              Your private invite link
              <textarea
                className="invite-link"
                value={url}
                readOnly
                rows={3}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <button className="ui-button primary" onClick={() => void copy()}>
              <Icon name={copied ? "check" : "copy"} />
              {copied ? "Link copied" : "Copy invite link"}
            </button>
            <InviteQr url={url} />
            {invite?.kind === "group" ? (
              <Link
                className="ui-button primary"
                href={roomUrl(groupBookmark(invite, true))}
              >
                <Icon name="chat" /> Open group & admit guests
              </Link>
            ) : (
              <div className="ui-alert info" role="status">
                Waiting for your guest. Keep this page open, or return from
                Home.
              </div>
            )}
          </>
        )}
        {invite && (
          <p className="small muted">
            Expires {new Date(invite.expires).toLocaleString()}. Share only with
            {invite.kind === "group"
              ? " the members you want to invite."
              : " the person you want to invite."}
          </p>
        )}
        <div className="invite-steps">
          <div className="invite-step">
            <span className="step-number">1</span>
            <div>
              <h3>Connect your wallet</h3>
              <p>Choose the Canton account you want to use.</p>
            </div>
          </div>
          <div className="invite-step">
            <span className="step-number">2</span>
            <div>
              <h3>
                {creating
                  ? "Create and share your invite"
                  : "Join the conversation"}
              </h3>
              <p>
                {creating
                  ? "Copy the link or download its QR. Guests open it and connect their Canton wallets."
                  : "Approve the connection request in your wallet. VINSS prepares the encrypted session."}
              </p>
            </div>
          </div>
          <div className="invite-step">
            <span className="step-number">3</span>
            <div>
              <h3>
                {group
                  ? creating || owner
                    ? "Open your group"
                    : "Chat with your group"
                  : "Create an offer when ready"}
              </h3>
              <p>
                {group
                  ? creating || owner
                    ? "Keep the group open to admit guests. Start chatting when members arrive."
                    : "The creator admits you with an MLS Welcome. Messages become available when the group is ready."
                  : "Review the terms together, then submit your offer from the private room."}
              </p>
            </div>
          </div>
        </div>
        {invite && (
          <details className="advanced">
            <summary>Connection details</summary>
            <p className="small muted break-word advanced-content">
              Invited by {shortId(invite.host)} · {invite.id}
            </p>
          </details>
        )}
      </div>
    </div>
  );
}
