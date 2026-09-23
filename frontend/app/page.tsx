import Link from "next/link";

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M12 3.2 19 6v5.2c0 4.5-2.7 7.8-7 9.6-4.3-1.8-7-5.1-7-9.6V6l7-2.8Z" />
      <path
        d="m8.8 12 2.1 2 4.5-4.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

const lifecycle = [
  ["01", "CHAT", "Private conversation"],
  ["02", "OFFER", "Structured agreement"],
  ["03", "DEAL", "Canton workflow"],
  ["04", "SETTLE", "Release or resolve"],
  ["05", "PROOF", "Verifiable evidence"],
] as const;

export default function Home() {
  return (
    <main className="vinss-page vinss-home">
      <div className="relative z-10 mx-auto w-full max-w-[1220px] px-4 pb-14 pt-5 sm:px-7 lg:px-10">
        <header className="relative flex items-center justify-between border-b border-wire/55 pb-5">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[22px] font-semibold tracking-[-0.055em] text-paper">
                VINSS
              </p>
            </div>

            <span className="h-6 w-px bg-wire/70" />

            <p className="text-[8px] uppercase tracking-[0.18em] text-paper/30">
              Private Deal Room
              <span className="mx-1.5 text-signal/50">
                ·
              </span>
              Canton
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-wire/60 bg-vault/35 px-3 py-2">
            <span className="vinss-live-dot" />
            <span className="text-[8px] uppercase tracking-[0.12em] text-paper/40">
              OpenMLS
            </span>
          </div>
        </header>

        <section className="relative overflow-hidden py-20 sm:py-28">
          <div
            aria-hidden="true"
            className="absolute right-[-80px] top-8 h-[360px] w-[360px] rounded-full border border-signal/[0.07]"
          />

          <div
            aria-hidden="true"
            className="absolute right-[40px] top-[90px] h-[220px] w-[220px] rounded-full border border-paper/[0.035]"
          />

          <div className="relative max-w-3xl">
            <p className="text-[9px] uppercase tracking-[0.22em] text-signal/60">
              Private Deal Room on Canton
            </p>

            <h1 className="mt-5 text-[clamp(42px,8vw,78px)] font-medium leading-[0.96] tracking-[-0.065em] text-paper">
              Negotiate privately.
              <br />
              <span className="text-signal">
                Settle with confidence.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-[13px] leading-7 text-paper/38 sm:text-[15px]">
              VINSS keeps private conversation and deal context inside one secure room, with OpenMLS protecting content before Canton carries the workflow.
            </p>

            <div className="mt-7 flex max-w-lg items-center gap-3 rounded-2xl border border-wire/60 bg-vault/30 px-4 py-3.5">
              <span className="text-signal/70">
                <ShieldIcon />
              </span>

              <p className="text-[11px] leading-5 text-paper/44">
                Deals do not begin with a transaction. They begin with trust.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#rooms"
                className="inline-flex h-11 items-center gap-4 rounded-xl border border-signal/30 bg-signal px-5 text-[10px] font-medium uppercase tracking-[0.13em] text-ink"
              >
                Open workspace
                <span>→</span>
              </Link>

              <a
                href="#workflow"
                className="inline-flex h-11 items-center rounded-xl border border-wire/70 bg-vault/30 px-5 text-[10px] uppercase tracking-[0.13em] text-paper/50"
              >
                How it works
              </a>
            </div>
          </div>
        </section>

        <aside className="overflow-hidden rounded-2xl border border-wire/65 bg-vault/25">
          <header className="flex items-center justify-between border-b border-wire/50 px-4 py-3">
            <span className="text-[8px] uppercase tracking-[0.17em] text-paper/35">
              Privacy boundary
            </span>

            <span className="flex items-center gap-2 text-[8px] uppercase tracking-[0.13em] text-signal/65">
              <span className="vinss-live-dot" />
              Active
            </span>
          </header>

          <div className="grid sm:grid-cols-2">
            <div className="border-b border-wire/45 p-5 sm:border-b-0 sm:border-r">
              <p className="text-[9px] uppercase tracking-[0.14em] text-signal/65">
                Hidden
              </p>

              <p className="mt-2 text-[12px] leading-6 text-paper/38">
                Messages · Deal terms · MLS group state · Private room context
              </p>
            </div>

            <div className="p-5">
              <p className="text-[9px] uppercase tracking-[0.14em] text-paper/40">
                Visible where required
              </p>

              <p className="mt-2 text-[12px] leading-6 text-paper/38">
                Canton parties · Delivery metadata · Workflow state required by participants
              </p>
            </div>
          </div>
        </aside>

        <section
          id="workflow"
          className="mt-14"
        >
          <div className="mb-5 flex items-center gap-4">
            <p className="text-[8px] uppercase tracking-[0.18em] text-paper/35">
              Deal lifecycle
            </p>

            <span className="h-px flex-1 bg-wire/45" />

            <small className="hidden text-[8px] text-paper/20 sm:block">
              Conversation → Agreement → Workflow → Settlement → Evidence
            </small>
          </div>

          <div className="grid overflow-hidden rounded-2xl border border-wire/60 bg-vault/20 sm:grid-cols-5">
            {lifecycle.map(
              (
                [
                  number,
                  label,
                  title,
                ],
                index,
              ) => (
                <article
                  key={label}
                  className="relative border-b border-wire/45 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
                >
                  <span className="text-[8px] text-paper/18">
                    {number}
                  </span>

                  <h2 className="mt-5 text-[9px] uppercase tracking-[0.15em] text-signal/65">
                    {label}
                  </h2>

                  <p className="mt-1 text-[10px] leading-5 text-paper/34">
                    {title}
                  </p>

                  {index <
                    lifecycle.length -
                      1 && (
                    <span className="absolute right-3 top-1/2 hidden text-paper/12 sm:block">
                      →
                    </span>
                  )}
                </article>
              ),
            )}
          </div>
        </section>

        <section
          id="rooms"
          className="mt-14"
        >
          <div className="rounded-2xl border border-wire/65 bg-[#080d12]/90 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.28)] sm:p-6">
            <div className="flex items-center justify-between border-b border-wire/45 pb-4">
              <div>
                <p className="text-[8px] uppercase tracking-[0.17em] text-signal/55">
                  Workspace
                </p>

                <h2 className="mt-1 text-[18px] font-medium text-paper/72">
                  Private deal rooms
                </h2>
              </div>

              <span className="rounded-full border border-signal/15 bg-signal/[0.04] px-3 py-1.5 text-[8px] uppercase tracking-[0.12em] text-signal/60">
                Canton
              </span>
            </div>

            <Link
              href="/room/private-deal"
              className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-wire/55 bg-vault/35 px-4 py-4 transition hover:border-signal/25 hover:bg-signal/[0.025]"
            >
              <div>
                <p className="text-[12px] font-medium text-paper/66">
                  VINSS Secure Room
                </p>

                <p className="mt-1 text-[9px] text-paper/26">
                  OpenMLS encrypted · Canton transport
                </p>
              </div>

              <span className="text-signal/55">
                →
              </span>
            </Link>
          </div>
        </section>

        <footer className="mt-16 border-t border-wire/45 py-7">
          <div className="flex items-center justify-between">
            <p className="text-[9px] uppercase tracking-[0.16em] text-paper/24">
              © 2026 VINSS
            </p>

            <p className="text-[9px] text-paper/20">
              Private Deal Network
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
