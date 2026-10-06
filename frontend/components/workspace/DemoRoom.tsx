"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "./Icon";
import { RoomTabs, type RoomTab } from "@/components/room/RoomTabs";
import { validJob, type JobListing } from "@/lib/job-types";
const phases = [
  "Offer received",
  "Escrow funded",
  "Work submitted",
  "Work approved",
  "Settled",
] as const;
export function DemoRoom() {
  const id = useSearchParams().get("job") || "sample-1";
  const [job, setJob] = useState<JobListing | null>(null),
    [phase, setPhase] = useState(0),
    [tab, setTab] = useState<RoomTab>("message"),
    [draft, setDraft] = useState(""),
    [messages, setMessages] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    setJob(null);
    setPhase(0);
    setMessages([]);
    void fetch(`/api/jobs/${encodeURIComponent(id)}?demo=1`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (validJob(j) && !controller.signal.aborted) setJob(j);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [id]);
  const title = job?.title || "Brand identity for an independent studio",
    amount = job?.budget || "350";
  const offer = (
    <article className="offer-card">
      <div className="offer-top">
        <span className="text-link">
          <Icon name="file" />
          Private offer
        </span>
        <span className={"badge " + (phase ? "green" : "amber")}>
          {phases[phase]}
        </span>
      </div>
      <h3>{title}</h3>
      <div className="deal-amount">
        {amount} <small>USDCx</small>
      </div>
      <p className="small muted">
        {job?.delivery || "7 days"} · Canton escrow / rekber
      </p>
      <div className="escrow-track" aria-hidden="true">
        {phases.map((_, i) => (
          <span key={i} className={i <= phase ? "done" : ""} />
        ))}
      </div>
      <p className="small muted">
        {phase === 0
          ? "Review the offer before funding."
          : phase === 1
            ? "Payment is reserved for this agreement."
            : phase === 2
              ? "Delivery is ready for review."
              : phase === 3
                ? "Approved for settlement to the payee."
                : "Settlement receipt available."}
      </p>
      {phase < 4 ? (
        <div className="actions">
          <button
            className="ui-button primary"
            onClick={() => setPhase((p) => Math.min(4, p + 1))}
          >
            {
              [
                "Accept & fund escrow",
                "Submit work",
                "Approve work",
                "Settle escrow",
              ][phase]
            }
          </button>
        </div>
      ) : (
        <div className="ui-alert info" style={{ marginTop: 18 }}>
          <Icon name="check" /> Demo settlement complete
        </div>
      )}
      <div className="offer-foot">Simulation · no funds are moved.</div>
    </article>
  );
  return (
    <>
      <div className="ui-alert info" style={{ marginBottom: 24 }}>
        DEMO MODE · Sample conversation and simulated escrow.{" "}
        <Link className="text-link" href="/jobs?demo=1">
          Back to sample jobs
        </Link>
      </div>
      <div className="room-heading">
        <span className="avatar">M</span>
        <div className="room-heading-copy">
          <h1>Conversation with Maya</h1>
          <p className="small muted">{title}</p>
        </div>
        <button
          className="ui-button"
          onClick={() => {
            setPhase(0);
            setMessages([]);
            setDraft("");
          }}
        >
          Reset demo
        </button>
      </div>
      <RoomTabs value={tab} onChange={setTab} />
      <div id="room-tab-panel" role="tabpanel" aria-labelledby={"tab-" + tab}>
        {tab === "message" ? (
          <div className="chat-surface">
            <div className="chat-header">
              <span className="avatar">M</span>
              <div>
                <h3>Maya · Example participant</h3>
                <span className="small muted">Private deal walkthrough</span>
              </div>
              <span className="badge">Demo</span>
            </div>
            <div className="chat-feed">
              <div className="bubble">
                <p>
                  Hi! I’ve put the scope and delivery timeline into an offer.
                  Let me know what you think.
                </p>
                <small>10:24 · Example</small>
              </div>
              <div className="bubble own">
                <p>
                  Looks good. Let’s keep the agreement and delivery in this
                  room.
                </p>
                <small>10:25 · Example</small>
              </div>
              {offer}
              {messages.map((m, i) => (
                <div className="bubble own" key={i}>
                  <p>{m}</p>
                  <small>Local demo message</small>
                </div>
              ))}
            </div>
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) {
                  setMessages((v) => [...v, draft.trim()]);
                  setDraft("");
                }
              }}
            >
              <label className="sr-only" htmlFor="demo-message">
                Demo message
              </label>
              <textarea
                id="demo-message"
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a demo message…"
              />
              <div className="composer-actions">
                <button
                  className="ui-button"
                  type="button"
                  onClick={() => setTab("escrow")}
                >
                  <Icon name="shield" />
                  Escrow
                </button>
                <button
                  className="ui-button primary"
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label="Send local demo message"
                >
                  <Icon name="send" />
                </button>
              </div>
            </form>
          </div>
        ) : tab === "escrow" ? (
          <div className="escrow-board">
            {offer}
            <div className="surface padded">
              <h2>A clear settlement flow.</h2>
              <div className="invite-steps">
                {phases.map((p, i) => (
                  <div className="invite-step" key={p}>
                    <span className="step-number">
                      {i <= phase ? <Icon name="check" /> : i + 1}
                    </span>
                    <div>
                      <h3>{p}</h3>
                      <p>
                        {i <= phase
                          ? "Completed in this simulation"
                          : "Next step"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <section className="surface padded">
            <h2>Demo activity</h2>
            {phases.slice(0, phase + 1).map((p) => (
              <div className="activity-row" key={p}>
                <Icon name="check" />
                <div>
                  <h3>{p}</h3>
                  <p className="small muted">
                    Simulated state · no ledger transaction
                  </p>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
