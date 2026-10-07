"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "./Icon";
import { JOB_CATEGORIES, type JobListing } from "@/lib/job-types";
import { assetName } from "@/lib/workspace";
interface Results {
  items: JobListing[];
  total: number;
  page: number;
  pages: number;
}
export function JobsBrowser() {
  const params = useSearchParams(),
    demo = params.get("demo") === "1";
  const [q, setQ] = useState(""),
    [category, setCategory] = useState("All"),
    [page, setPage] = useState(1),
    [data, setData] = useState<Results>({
      items: [],
      total: 0,
      page: 1,
      pages: 1,
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    setLoading(true);
    setError("");
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const query = new URLSearchParams({
        q,
        category,
        page: String(page),
        ...(demo ? { demo: "1" } : {}),
      });
      void fetch(`/api/jobs?${query}`, { signal: controller.signal })
        .then((r) => {
          if (!r.ok) throw new Error("Could not load jobs. Please try again.");
          return r.json();
        })
        .then((d) => {
          if (!controller.signal.aborted) setData(d);
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, category, page, demo, retry]);
  const hasPreviewListings = data.items.some((job) => job.demo);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MARKETPLACE</p>
          <h1 style={{ marginTop: 10 }}>Find your next project.</h1>
          <p className="muted">
            Browse jobs. Discuss the scope privately. Get paid through escrow.
          </p>
        </div>
        <Link className="ui-button" href="/invite/new">
          <Icon name="plus" />
          Private invite
        </Link>
      </div>
      {demo && (
        <div className="ui-alert info">
          Demo catalogue · {data.total || 18} sample listings for a product
          walkthrough.{" "}
          <Link href="/jobs" className="text-link">
            View live jobs
          </Link>
        </div>
      )}
      {!demo && hasPreviewListings && (
        <div className="ui-alert info">
          Preview catalogue · Sample listings are shown while the live
          marketplace is onboarding publishers.
          <Link href="/invite/new" className="text-link">
            Start a private deal
          </Link>
        </div>
      )}
      <div className="toolbar">
        <label className="search-box">
          <Icon name="search" />
          <span className="sr-only">Search jobs</span>
          <input
            value={q}
            placeholder="Search jobs or skills…"
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            maxLength={200}
          />
        </label>
        <span className="small muted" role="status">
          {loading
            ? "Loading…"
            : `${data.total} ${demo ? "sample jobs" : "market listings"}`}
        </span>
      </div>
      <div className="filter-chips" aria-label="Job categories">
        {JOB_CATEGORIES.map((c) => (
          <button
            className="filter-chip"
            key={c}
            aria-pressed={category === c}
            onClick={() => {
              setCategory(c);
              setPage(1);
            }}
          >
            {c}
          </button>
        ))}
      </div>
      {error ? (
        <div className="ui-alert error" role="alert">
          {error}
          <button className="ui-button" onClick={() => setRetry((v) => v + 1)}>
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="loading" aria-live="polite">
          Finding your next project…
        </div>
      ) : data.items.length ? (
        <div className="job-grid">
          {data.items.map((j) => (
            <Link
              className="surface job-card"
              data-category={j.category}
              key={j.id}
              href={`/jobs/${encodeURIComponent(j.id)}${j.demo ? "?demo=1" : ""}`}
            >
              <div className="job-top">
                <span className="avatar">
                  <Icon
                    name={
                      j.category === "Development"
                        ? "file"
                        : j.category === "Design"
                          ? "gem"
                          : "jobs"
                    }
                  />
                </span>
                <div>
                  <span className="small muted">{j.publisher}</span>
                  <div>
                    <span className="badge">{j.category}</span>
                  </div>
                </div>
              </div>
              <h3>{j.title}</h3>
              <p>{j.description}</p>
              <div className="job-meta">
                {j.tags.map((t) => (
                  <span className="badge" key={t}>
                    {t}
                  </span>
                ))}
              </div>
              <div className="job-bottom">
                <div>
                  <span className="small muted">Project budget</span>
                  <div className="job-budget">
                    {j.budget} <small>{assetName(j.asset)}</small>
                  </div>
                </div>
                <span className="small muted">
                  {j.delivery}
                  <br />
                  {j.demo ? "Sample job" : "View job"} ↗
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="surface empty-state jobs-empty">
          <Icon name="jobs" />
          <h2>
            {q || category !== "All"
              ? "No jobs match these filters."
              : "No public jobs yet"}
          </h2>
          <p>
            {q || category !== "All"
              ? "Try another skill or category."
              : "Have a client already? Create an invite and start a private deal."}
          </p>
          {q || category !== "All" ? (
            <button
              className="ui-button"
              onClick={() => {
                setQ("");
                setCategory("All");
                setPage(1);
              }}
            >
              Clear filters
            </button>
          ) : (
            <div className="actions">
              <Link className="ui-button primary" href="/invite/new">
                Invite a client
              </Link>
              <Link className="ui-button" href="/jobs?demo=1">
                Explore sample jobs
              </Link>
            </div>
          )}
        </div>
      )}
      {!loading && data.pages > 1 && (
        <nav className="pagination" aria-label="Jobs pagination">
          <button
            className="ui-button"
            disabled={data.page <= 1}
            onClick={() => setPage(data.page - 1)}
          >
            Previous
          </button>
          <span>
            Page {data.page} of {data.pages}
          </span>
          <button
            className="ui-button"
            disabled={data.page >= data.pages}
            onClick={() => setPage(data.page + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </>
  );
}
