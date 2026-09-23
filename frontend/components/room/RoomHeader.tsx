"use client";

import Link from "next/link";

interface RoomHeaderProps {
  label: string;
  roomId: string;
  status:
    | "idle"
    | "connecting"
    | "waiting_peer"
    | "ready";
}

export function RoomHeader({
  label,
  roomId,
  status,
}: RoomHeaderProps) {
  const statusLabel =
    status === "ready"
      ? "Encrypted"
      : status === "connecting"
        ? "Connecting"
        : status === "waiting_peer"
          ? "Waiting peer"
          : "Offline";

  return (
    <header className="mb-4">
      <div className="flex items-center gap-2.5">
        <Link
          href="/#rooms"
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
            {label}
          </h1>

          <p className="mt-0.5 hidden truncate font-mono text-[8px] text-paper/20 sm:block">
            {roomId}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-wire/60 bg-vault/45 px-3 py-2">
          <span
            className={
              status === "ready"
                ? "vinss-live-dot"
                : "h-1.5 w-1.5 rounded-full bg-paper/25"
            }
          />

          <span className="text-[8px] uppercase tracking-[0.13em] text-paper/45">
            {statusLabel}
          </span>
        </div>
      </div>
    </header>
  );
}
