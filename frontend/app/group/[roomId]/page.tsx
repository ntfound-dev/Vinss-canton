"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import type {
  GroupSnapshot,
  PlainMessage,
} from "../../../../src/messaging/types";
import { CantonGroupRuntime } from "@/lib/canton-group-runtime";
import { useWallet } from "@/components/workspace/WalletProvider";
import { Icon } from "@/components/workspace/Icon";
import { InviteQr } from "@/components/workspace/InviteQr";
import { encodeInvite, ownInvites } from "@/lib/canton-invite";
import { readRooms, shortId } from "@/lib/workspace";
export default function GroupPage() {
  const { roomId } = useParams<{ roomId: string }>(),
    params = useSearchParams(),
    wallet = useWallet();
  const host = params.get("peerParty"),
    hostInstallation = params.get("peerInstallation"),
    creator = params.get("mode") === "creator";
  const [runtime, setRuntime] = useState<CantonGroupRuntime | null>(null),
    [messages, setMessages] = useState<PlainMessage[]>([]),
    [snapshot, setSnapshot] = useState<GroupSnapshot>(),
    [error, setError] = useState(""),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState(""),
    [title, setTitle] = useState("Group conversation"),
    [copied, setCopied] = useState(false);
  const feed = useRef<HTMLDivElement>(null),
    nearBottom = useRef(true);
  function merge(incoming: readonly PlainMessage[]) {
    setMessages((prev) =>
      [...new Map([...prev, ...incoming].map((m) => [m.id, m])).values()].sort(
        (a, b) => a.sentAt - b.sentAt,
      ),
    );
  }
  useEffect(() => {
    setMessages([]);
    setSnapshot(undefined);
    setError("");
    setRuntime(null);
    setUrl("");
    setDraft("");
    if (!host || !hostInstallation) {
      setError(
        "This group link is incomplete. Open it from your inbox or the original invite.",
      );
      return;
    }
    if (!wallet.session) return;
    let stopped = false,
      room: CantonGroupRuntime | undefined;
    const party = wallet.session.partyId;
    const bookmark = readRooms(party).find(
      (r) => r.id === roomId && r.kind === "group",
    );
    setTitle(bookmark?.title || "Group conversation");
    const invite = ownInvites(party).find(
      (i) => i.id === roomId && i.kind === "group",
    );
    if (invite) setUrl(`${location.origin}/invite#${encodeInvite(invite)}`);
    void CantonGroupRuntime.connect({
      conversationId: roomId,
      title: bookmark?.title || "VINSS group",
      walletParty: party,
      hostParty: host,
      hostInstallation,
      creator,
      onMessages(m) {
        if (!stopped) merge(m);
      },
      onState(s) {
        if (!stopped) setSnapshot(s);
      },
      onError(e) {
        if (!stopped) setError(e.message);
      },
    })
      .then((r) => {
        room = r;
        if (stopped) void r.close();
        else setRuntime(r);
      })
      .catch((e) => {
        if (!stopped) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      stopped = true;
      void room?.close();
    };
  }, [roomId, wallet.session?.partyId, host, hostInstallation, creator]);
  useEffect(() => {
    if (feed.current && nearBottom.current)
      feed.current.scrollTop = feed.current.scrollHeight;
  }, [messages]);
  const ready = !!runtime && !!snapshot && snapshot.members.length > 1;
  async function send() {
    if (!runtime || busy || !ready || !draft.trim()) return;
    setBusy(true);
    setError("");
    try {
      merge([await runtime.sendText(draft)]);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ENCRYPTED GROUP CHAT</p>
          <h1>{snapshot?.metadata.title || title}</h1>
          <p className="muted">
            {snapshot
              ? `${snapshot.members.length} members · MLS epoch ${snapshot.epoch}`
              : error
                ? "Connection needs attention"
                : !wallet.session
                  ? "Connect your Canton wallet"
                  : "Preparing the group connection…"}
          </p>
        </div>
        <Link className="text-link" href="/rooms">
          Back to inbox <Icon name="arrow" />
        </Link>
      </div>
      {error && (
        <div className="ui-alert error" role="alert">
          {error}
        </div>
      )}
      {!wallet.session && (
        <button
          className="ui-button primary"
          disabled={wallet.busy || wallet.loading}
          onClick={() => void wallet.connect()}
        >
          <Icon name="wallet" />
          Connect wallet to join
        </button>
      )}
      <section className="chat-surface group-chat">
        <div className="chat-header">
          <span className="avatar">
            <Icon name="chat" />
          </span>
          <div>
            <h3>{ready ? "Group ready" : "Waiting for members"}</h3>
            <span className="small muted">
              Plaintext on this device · ciphertext on Canton
            </span>
          </div>
          <span className="badge">
            <Icon name="shield" />
            OpenMLS
          </span>
        </div>
        <div
          className="chat-feed"
          ref={feed}
          onScroll={() => {
            const e = feed.current;
            if (e)
              nearBottom.current =
                e.scrollHeight - e.scrollTop - e.clientHeight < 100;
          }}
          aria-label="Group conversation"
        >
          {!messages.length && (
            <div className="empty-state">
              <Icon name="chat" />
              <h3>
                {ready
                  ? "Your group is ready to talk."
                  : "Invite members to start chatting."}
              </h3>
              <p>
                {creator
                  ? "Share the invite. Keep this group open while guests connect their wallets."
                  : "The creator must open this group to admit you and publish the MLS Welcome."}
              </p>
            </div>
          )}
          {messages
            .filter(
              (m) => m.content.type === "text" || m.content.type === "reply",
            )
            .map((m) => (
              <div
                key={m.id}
                className={
                  "bubble" +
                  (m.senderUserId === `wallet:${wallet.session?.partyId}`
                    ? " own"
                    : "")
                }
              >
                <span className="group-sender">
                  {m.senderUserId === `wallet:${wallet.session?.partyId}`
                    ? "You"
                    : shortId(m.senderUserId.replace(/^wallet:/, ""))}
                </span>
                <p>
                  {m.content.type === "text" || m.content.type === "reply"
                    ? m.content.text
                    : ""}
                </p>
                <small>
                  {new Date(m.sentAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </div>
            ))}
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="group-message">
            Group message
          </label>
          <textarea
            id="group-message"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send();
              }
            }}
            maxLength={10000}
            placeholder={
              ready ? "Message the group…" : "Waiting for the encrypted group…"
            }
            disabled={!ready || busy}
          />
          <div className="composer-actions">
            <span className="small muted">
              Stored locally after send/decrypt
            </span>
            <button
              className="ui-button primary"
              aria-label="Send group message"
              disabled={!ready || busy || !draft.trim()}
            >
              <Icon name="send" />
            </button>
          </div>
        </form>
      </section>
      {snapshot && (
        <details className="advanced">
          <summary>Group members ({snapshot.members.length})</summary>
          <div className="advanced-content">
            {snapshot.members.map((m) => (
              <div className="group-member" key={m.installationId}>
                <Icon name="account" />
                <span>{shortId(new TextDecoder().decode(m.credential))}</span>
                <span className="badge">
                  {m.role === "super_admin" ? "Creator" : "Member"}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
      {url && (
        <details className="advanced">
          <summary>Share group invite / QR</summary>
          <div className="advanced-content">
            <InviteQr url={url} />
            <button
              className="ui-button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(url)
                  .then(() => setCopied(true))
                  .catch(() =>
                    setError(
                      "Copy unavailable. Open the original invite to copy its link.",
                    ),
                  );
              }}
            >
              <Icon name={copied ? "check" : "copy"} />
              {copied ? "Copied" : "Copy group invite"}
            </button>
          </div>
        </details>
      )}
      <p className="small muted section-spacer">
        Offers and escrow remain in two-person private deals.
      </p>
    </>
  );
}
