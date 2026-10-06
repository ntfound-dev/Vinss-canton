"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "./WalletProvider";
import { Icon } from "./Icon";
import { validJob, type JobListing } from "@/lib/job-types";
import { CantonDappLedgerClient } from "@/lib/canton-dapp-ledger-client";
import { startJobConversation } from "@/lib/job-conversations";
import { assetName, rememberRoom, readRooms, roomUrl } from "@/lib/workspace";
export function JobDetail() {
  const { id } = useParams<{ id: string }>(),
    demo = useSearchParams().get("demo") === "1",
    router = useRouter(),
    wallet = useWallet();
  const [job, setJob] = useState<JobListing | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(`/api/jobs/${encodeURIComponent(id)}${demo ? "?demo=1" : ""}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("This job is no longer available.");
        return r.json();
      })
      .then((data) => {
        if (!validJob(data)) throw new Error("The job details are invalid.");
        if (!controller.signal.aborted) setJob(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, demo]);
  async function discuss() {
    if (!job || !wallet.session || busy) return;
    setBusy(true);
    setError("");
    try {
      const previous = readRooms(wallet.session.partyId).find(
        (r) => r.jobId === job.id && r.peerParty === job.ownerParty,
      );
      if (previous) {
        router.push(roomUrl(previous));
        return;
      }
      const ledger = await CantonDappLedgerClient.connect(
        wallet.session.partyId,
      );
      const room = await startJobConversation(
        ledger,
        job,
        wallet.session.partyId,
      );
      rememberRoom(wallet.session.partyId, room);
      router.push(roomUrl(room));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <div className="loading">Loading job details…</div>;
  if (!job)
    return (
      <div className="surface empty-state">
        <h2>Job unavailable</h2>
        <p>{error}</p>
        <Link className="ui-button" href="/jobs">
          Back to jobs
        </Link>
      </div>
    );
  return (
    <>
      <Link className="text-link" href={demo ? "/jobs?demo=1" : "/jobs"}>
        ← Back to jobs
      </Link>
      {demo && (
        <div className="ui-alert info" style={{ marginTop: 20 }}>
          Sample job · product walkthrough only. No application or payment is
          submitted.
        </div>
      )}
      <div className="job-detail section-spacer">
        <article className="surface padded">
          <div className="job-top">
            <span className="avatar">
              <Icon name="jobs" />
            </span>
            <div>
              <h3>{job.publisher}</h3>
              <span className="small muted">
                {job.category} · Canton {job.network}
              </span>
            </div>
          </div>
          <h1>{job.title}</h1>
          <div className="job-meta">
            {job.tags.map((t) => (
              <span className="badge" key={t}>
                {t}
              </span>
            ))}
          </div>
          <h2>About the project</h2>
          <p className="job-description">{job.description}</p>
          <div className="ui-alert info" style={{ marginTop: 28 }}>
            Final scope, price, and acceptance terms are agreed privately before
            funding an escrow.
          </div>
        </article>
        <aside className="surface padded stack" style={{ alignSelf: "start" }}>
          <div>
            <p className="small muted">Project budget</p>
            <div className="stat-value">
              {job.budget}{" "}
              <span className="small muted">{assetName(job.asset)}</span>
            </div>
          </div>
          <div>
            <p className="small muted">Expected delivery</p>
            <h3>{job.delivery}</h3>
          </div>
          <span className="badge green">
            <Icon name="shield" />
            Private offer · Canton escrow
          </span>
          {error && (
            <p className="ui-alert error" role="alert">
              {error}
            </p>
          )}
          {demo ? (
            <Link className="ui-button primary" href={`/demo?job=${job.id}`}>
              Preview private deal
              <Icon name="arrow" />
            </Link>
          ) : !wallet.session ? (
            <button
              className="ui-button primary"
              disabled={wallet.busy}
              onClick={() => void wallet.connect()}
            >
              Connect wallet to discuss
            </button>
          ) : (
            <button
              className="ui-button primary"
              disabled={busy || job.ownerParty === wallet.session.partyId}
              onClick={() => void discuss()}
            >
              {busy
                ? "Preparing conversation…"
                : job.ownerParty === wallet.session.partyId
                  ? "This is your job"
                  : "Discuss privately"}
            </button>
          )}
          <p className="small muted">
            A conversation starts the discussion. It does not accept the job or
            authorize a payment.
          </p>
        </aside>
      </div>
    </>
  );
}
