import Link from "next/link";

export default function Home() {
  return (
    <main className="vinss-page">
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-wire/50 pb-5">
          <div>
            <p className="text-[9px] uppercase tracking-[0.24em] text-signal/60">
              Private Deal Network
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-paper">
              VINSS
            </h1>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-paper/45">
            <span className="vinss-live-dot" />
            Canton · OpenMLS
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center py-20">
          <div className="vinss-panel w-full max-w-xl p-7 sm:p-9">
            <p className="text-[9px] uppercase tracking-[0.2em] text-signal/55">
              Secure workspace
            </p>

            <h2 className="mt-3 text-3xl font-medium tracking-[-0.045em] text-paper">
              Private deals.
              <br />
              Private conversations.
            </h2>

            <p className="mt-4 max-w-md text-sm leading-6 text-paper/45">
              Room content is protected by OpenMLS.
              Canton carries the encrypted deal state and delivery.
            </p>

            <div className="mt-8 border-t border-wire/45 pt-5">
              <p className="text-xs text-paper/32">
                No local room is selected yet.
                Open a VINSS room from an invitation or room identifier.
              </p>

              <Link
                href="/room/private-deal"
                className="mt-5 inline-flex border border-signal/25 bg-signal/[0.06] px-4 py-2.5 text-xs font-medium text-signal transition hover:bg-signal/[0.1]"
              >
                Preview room shell →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
