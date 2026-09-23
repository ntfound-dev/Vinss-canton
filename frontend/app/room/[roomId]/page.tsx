"use client";

import Link from "next/link";
import {
  useParams,
} from "next/navigation";
import {
  FormEvent,
  useState,
} from "react";

type RoomTab =
  | "message"
  | "group"
  | "activity"
  | "loyalty";

export default function RoomPage() {
  const params =
    useParams<{
      roomId: string;
    }>();

  const [tab, setTab] =
    useState<RoomTab>(
      "message",
    );

  const [draft, setDraft] =
    useState("");

  function send(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    // Intentionally no local/mock delivery.
    // Next patch wires this directly into
    // OpenMlsMessagingProvider.
  }

  const items:
    readonly {
      key: RoomTab;
      label: string;
    }[] = [
      {
        key: "message",
        label: "Message",
      },
      {
        key: "group",
        label: "Group",
      },
      {
        key: "activity",
        label: "Activity",
      },
      {
        key: "loyalty",
        label: "Loyalty",
      },
    ];

  return (
    <main className="vinss-page">
      <div className="relative z-10 mx-auto min-h-screen max-w-5xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-4 flex items-center gap-2.5">
          <Link
            href="/"
            aria-label="Back to rooms"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vault/55 text-lg text-paper/55 ring-1 ring-wire/60 transition hover:text-signal hover:ring-signal/25"
          >
            ←
          </Link>

          <div className="min-w-0 flex-1">
            <p className="text-[8px] uppercase tracking-[0.17em] text-signal/55">
              Private Deal Room
            </p>

            <h1 className="mt-0.5 truncate text-[18px] font-medium tracking-tight text-paper">
              VINSS Secure Room
            </h1>

            <p className="mt-0.5 truncate font-mono text-[8px] text-paper/20">
              {params.roomId}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 border border-signal/15 bg-signal/[0.04] px-3 py-2 text-[9px] uppercase tracking-[0.12em] text-signal/70">
            <span className="vinss-live-dot" />
            Secure
          </div>
        </header>

        <nav
          aria-label="Deal room navigation"
          className="mb-3 rounded-2xl bg-vault/35 p-1 ring-1 ring-wire/65"
        >
          <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-4">
            {items.map(
              (item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    setTab(
                      item.key,
                    )
                  }
                  className={
                    tab === item.key
                      ? "min-w-[108px] flex-1 rounded-xl bg-signal/[0.09] px-3 py-2.5 text-[11px] font-medium text-signal ring-1 ring-signal/15 sm:min-w-0"
                      : "min-w-[108px] flex-1 rounded-xl px-3 py-2.5 text-[11px] font-medium text-paper/38 transition hover:bg-white/[0.02] hover:text-paper/70 sm:min-w-0"
                  }
                >
                  {item.label}
                </button>
              ),
            )}
          </div>
        </nav>

        <div className="mb-3 flex items-center justify-between border border-wire/45 bg-vault/20 px-3 py-2 text-[9px]">
          <span className="text-paper/35">
            OpenMLS encrypted session
          </span>

          <span className="text-signal/60">
            Canton transport
          </span>
        </div>

        {tab === "message" && (
          <section className="vinss-panel flex min-h-[66vh] flex-col">
            <div className="border-b border-wire/45 px-4 py-3">
              <p className="text-[9px] uppercase tracking-[0.16em] text-paper/30">
                Private conversation
              </p>
            </div>

            <div className="flex flex-1 items-center justify-center px-6 py-16 text-center">
              <div>
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center border border-signal/15 bg-signal/[0.04] text-signal/60">
                  ✦
                </div>

                <p className="text-sm text-paper/55">
                  No encrypted messages yet
                </p>

                <p className="mt-2 max-w-sm text-[11px] leading-5 text-paper/28">
                  Nothing is being mocked here.
                  Message delivery will use the existing OpenMLS → Canton transport.
                </p>
              </div>
            </div>

            <form
              onSubmit={send}
              className="border-t border-wire/45 p-3"
            >
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(
                    event,
                  ) =>
                    setDraft(
                      event.target
                        .value,
                    )
                  }
                  rows={1}
                  disabled
                  placeholder="Secure runtime connecting…"
                  className="min-h-11 flex-1 resize-none border border-wire/55 bg-black/20 px-3 py-3 text-xs text-paper outline-none placeholder:text-paper/20 disabled:opacity-55"
                />

                <button
                  type="submit"
                  disabled
                  className="h-11 border border-signal/20 bg-signal/[0.06] px-4 text-xs font-medium text-signal/45 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </form>
          </section>
        )}

        {tab === "group" && (
          <section className="vinss-panel min-h-[66vh] p-6">
            <p className="text-[9px] uppercase tracking-[0.16em] text-signal/55">
              MLS Groups
            </p>

            <h2 className="mt-3 text-lg font-medium text-paper">
              Group conversation
            </h2>

            <p className="mt-2 text-xs leading-5 text-paper/35">
              Member add/remove will use the durable MLS commit flow already tested against Canton.
            </p>
          </section>
        )}

        {tab === "activity" && (
          <section className="vinss-panel min-h-[66vh] p-6">
            <p className="text-[9px] uppercase tracking-[0.16em] text-signal/55">
              Activity
            </p>

            <p className="mt-3 text-xs text-paper/35">
              No Canton activity loaded yet.
            </p>
          </section>
        )}

        {tab === "loyalty" && (
          <section className="vinss-panel min-h-[66vh] p-6">
            <p className="text-[9px] uppercase tracking-[0.16em] text-signal/55">
              Loyalty
            </p>

            <p className="mt-3 text-xs text-paper/35">
              VINSS loyalty surface preserved for the product layer.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
