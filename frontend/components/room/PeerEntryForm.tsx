"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function localInstallationId(): string {
  const key = "vinss:installation:local-preview";

  try {
    const existing = window.localStorage.getItem(key);
    if (existing) {
      return existing;
    }

    const created = crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return "local-installation-unavailable";
  }
}

interface PeerEntryFormProps {
  defaultRoomId?: string;
  compact?: boolean;
}

export function PeerEntryForm({
  defaultRoomId = "private-deal",
  compact = false,
}: PeerEntryFormProps) {
  const router = useRouter();

  const [roomId, setRoomId] = useState(defaultRoomId);
  const [peerParty, setPeerParty] = useState("");
  const [peerInstallation, setPeerInstallation] = useState("");
  const [mode, setMode] = useState<"creator" | "joiner">("creator");
  const [myInstallation, setMyInstallation] = useState("");

  useEffect(() => {
    setMyInstallation(localInstallationId());
  }, []);

  const ready = useMemo(() => {
    return (
      roomId.trim().length > 0 &&
      peerParty.trim().length > 0 &&
      peerInstallation.trim().length > 0
    );
  }, [roomId, peerParty, peerInstallation]);

  function enterRoom() {
    if (!ready) {
      return;
    }

    const params = new URLSearchParams({
      peerParty: peerParty.trim(),
      peerInstallation: peerInstallation.trim(),
      mode,
    });

    router.push(
      `/room/${encodeURIComponent(roomId.trim())}?${params.toString()}`,
    );
  }

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-wire/65 bg-black/20 p-3.5"
          : "mt-4 rounded-xl border border-wire/55 bg-vault/35 p-4"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-paper/75">
            Enter private peer
          </p>
          <p className="mt-1 text-[9px] leading-4 text-paper/34">
            Room needs Canton Party + Installation ID of the
            counterparty. Without these, Offer and chat stay locked.
          </p>
        </div>
        <span className="rounded-full border border-signal/15 bg-signal/[0.04] px-2 py-0.5 text-[8px] uppercase tracking-[0.11em] text-signal/60">
          Required
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-[8px] uppercase tracking-[0.11em] text-paper/32">
            Room ID
          </span>
          <input
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            placeholder="private-deal"
            className="h-10 w-full rounded-lg border border-wire/65 bg-[#080d12] px-3 text-[11px] text-paper/75 outline-none placeholder:text-paper/20"
          />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-[8px] uppercase tracking-[0.11em] text-paper/32">
            Peer Canton Party
          </span>
          <input
            value={peerParty}
            onChange={(event) => setPeerParty(event.target.value)}
            placeholder="Party ID of counterparty"
            className="h-10 w-full rounded-lg border border-wire/65 bg-[#080d12] px-3 text-[11px] text-paper/75 outline-none placeholder:text-paper/20"
          />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-[8px] uppercase tracking-[0.11em] text-paper/32">
            Peer Installation ID
          </span>
          <input
            value={peerInstallation}
            onChange={(event) =>
              setPeerInstallation(event.target.value)
            }
            placeholder="Installation UUID of counterparty"
            className="h-10 w-full rounded-lg border border-wire/65 bg-[#080d12] px-3 text-[11px] text-paper/75 outline-none placeholder:text-paper/20"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[8px] uppercase tracking-[0.11em] text-paper/32">
            Your role
          </span>
          <select
            value={mode}
            onChange={(event) =>
              setMode(
                event.target.value === "joiner"
                  ? "joiner"
                  : "creator",
              )
            }
            className="h-10 w-full rounded-lg border border-wire/65 bg-[#080d12] px-3 text-[11px] text-paper/75 outline-none"
          >
            <option value="creator">Creator (host)</option>
            <option value="joiner">Joiner (guest)</option>
          </select>
        </label>

        <div className="space-y-1">
          <span className="text-[8px] uppercase tracking-[0.11em] text-paper/32">
            Your Installation (share this)
          </span>
          <p className="flex h-10 items-center overflow-hidden rounded-lg border border-wire/55 bg-black/25 px-3 text-[10px] text-paper/55">
            <span className="truncate">
              {myInstallation || "…"}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] text-paper/28">
          Also requires{" "}
          <span className="text-paper/45">
            NEXT_PUBLIC_CANTON_URL
          </span>{" "}
          on Vercel.
        </p>

        <button
          type="button"
          disabled={!ready}
          onClick={enterRoom}
          className="h-10 rounded-lg border border-signal/35 bg-signal/[0.08] px-4 text-[9px] uppercase tracking-[0.13em] text-signal disabled:opacity-30"
        >
          Enter room
        </button>
      </div>
    </div>
  );
}
