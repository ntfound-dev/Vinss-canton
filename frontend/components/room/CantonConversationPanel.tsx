"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { OfferCard } from "./offer/OfferCard";
import { OfferForm } from "./offer/OfferForm";
import { Icon } from "@/components/workspace/Icon";
import type {
  CantonRoomMessage,
  CantonRoomOffer,
  CantonRoomOfferInput,
  CantonRoomStatus,
} from "@/lib/canton-room-runtime";
export interface ConversationProps {
  messages: readonly CantonRoomMessage[];
  offers: readonly CantonRoomOffer[];
  draft: string;
  busy: boolean;
  configured: boolean;
  status: CantonRoomStatus | "idle" | "error";
  peerLabel: string;
  initialOfferValues?: Record<string, string>;
  onEscrow?(): void;
  onDraftChange(v: string): void;
  onSend(): void | Promise<void>;
  onCreateOffer(input: CantonRoomOfferInput): Promise<boolean>;
  onAcceptOffer(o: CantonRoomOffer): void | Promise<void>;
  onRejectOffer(o: CantonRoomOffer): void | Promise<void>;
  onSubmitFulfillment(o: CantonRoomOffer, s: string): void | Promise<void>;
  onRequestRevision(o: CantonRoomOffer, s: string): void | Promise<void>;
  onSubmitRevision(o: CantonRoomOffer, s: string): void | Promise<void>;
  onApproveFulfillment(o: CantonRoomOffer): void | Promise<void>;
  onSettleOffer(o: CantonRoomOffer): void | Promise<void>;
}
export function CantonConversationPanel(p: ConversationProps) {
  const ready = p.configured && p.status === "ready";
  const [offerOpen, setOfferOpen] = useState(false),
    feed = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const timeline = [
    ...p.messages.map((m) => ({
      kind: "message" as const,
      time: m.sentAt,
      id: m.id,
      value: m,
    })),
    ...p.offers.map((o) => ({
      kind: "offer" as const,
      time: o.sentAt,
      id: o.dealId,
      value: o,
    })),
  ].sort((a, b) => a.time - b.time);
  useEffect(() => {
    if (feed.current && nearBottom.current)
      feed.current.scrollTop = feed.current.scrollHeight;
  }, [p.messages, p.offers]);
  function keyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (ready && !p.busy && p.draft.trim()) void p.onSend();
    }
  }
  return (
    <section className="chat-surface">
      <div className="chat-header">
        <span className="avatar">
          <Icon name="chat" />
        </span>
        <div>
          <h3>{p.peerLabel}</h3>
          <span className="small muted">
            {ready
              ? "Encrypted conversation"
              : p.status === "waiting_peer"
                ? "Waiting for the other participant"
                : p.status === "error"
                  ? "Connection failed. Retry above."
                : "Preparing your private connection"}
          </span>
        </div>
        <span className="badge">
          <Icon name="shield" />
          {ready ? "Private" : p.status === "error" ? "Connection failed" : "Connecting"}
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
        aria-label="Conversation"
      >
        {!timeline.length && (
          <div className="empty-state">
            <Icon name="shield" />
            <h3>
              {ready
                ? "Say hello. Start something."
                : p.status === "error"
                  ? "Your private connection needs attention."
                : "Your private room is getting ready."}
            </h3>
            <p>
              {ready
                ? "Messages and offers stay in this private conversation. Create an offer whenever you’re ready."
                : p.status === "error"
                  ? "Review the error above and retry. Your draft stays here."
                  : p.status === "waiting_peer"
                    ? "Keep both rooms open and complete any remaining transaction approvals."
                    : "Preparing encryption keys and synchronizing with Canton. You can write a draft while you wait."}
            </p>
          </div>
        )}
        {timeline.map((item) =>
          item.kind === "offer" ? (
            <OfferCard
              key={"offer-" + item.id}
              offer={item.value}
              busy={p.busy || !ready}
              onAccept={p.onAcceptOffer}
              onReject={p.onRejectOffer}
              onSubmitFulfillment={p.onSubmitFulfillment}
              onRequestRevision={p.onRequestRevision}
              onSubmitRevision={p.onSubmitRevision}
              onApproveFulfillment={p.onApproveFulfillment}
              onSettle={p.onSettleOffer}
            />
          ) : (
            <div
              key={"message-" + item.id}
              className={"bubble" + (item.value.own ? " own" : "")}
            >
              <p>{item.value.text}</p>
              <small>
                {new Date(item.time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {item.value.own ? " · Sent" : ""}
              </small>
            </div>
          ),
        )}
      </div>
      {offerOpen && (
        <div className="chat-form">
          <OfferForm
            busy={p.busy}
            disabled={!ready}
            initialValues={p.initialOfferValues}
            onSubmit={p.onCreateOffer}
            onCancel={() => setOfferOpen(false)}
          />
        </div>
      )}
      <div className="composer">
        <label htmlFor="room-message" className="sr-only">
          Private message
        </label>
        <textarea
          id="room-message"
          rows={1}
          value={p.draft}
          onChange={(e) => p.onDraftChange(e.target.value)}
          onKeyDown={keyDown}
          disabled={p.busy}
          placeholder={
            ready
              ? "Write a private message…"
              : "Write a draft while connecting…"
          }
        />
        <div className="composer-actions">
          <button
            className="ui-button"
            disabled={!ready || p.busy}
            onClick={() => setOfferOpen(!offerOpen)}
            aria-expanded={offerOpen}
          >
            <Icon name="file" />
            Offer
          </button>
          <button className="ui-button" onClick={p.onEscrow}>
            <Icon name="shield" />
            Escrow
          </button>
          <button
            className="ui-button primary"
            onClick={() => void p.onSend()}
            disabled={!ready || p.busy || !p.draft.trim()}
            aria-label={p.busy ? "Sending" : "Send message"}
          >
            <Icon name="send" />
          </button>
        </div>
      </div>
    </section>
  );
}
