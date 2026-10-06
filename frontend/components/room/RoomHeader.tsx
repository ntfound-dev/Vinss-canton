"use client";
import Link from "next/link";
import { Icon } from "@/components/workspace/Icon";
export function RoomHeader({
  label,
  roomId,
  status,
}: {
  label: string;
  roomId: string;
  status: "idle" | "connecting" | "waiting_peer" | "ready";
}) {
  return (
    <header className="room-heading">
      <Link
        href="/rooms"
        className="icon-button"
        aria-label="Back to conversations"
      >
        ←
      </Link>
      <div className="room-heading-copy">
        <h1>{label}</h1>
        <p className="small muted">Private conversation · Canton</p>
      </div>
      <span className={"badge " + (status === "ready" ? "green" : "")}>
        <Icon name="shield" />
        {status === "ready"
          ? "Encrypted"
          : status === "waiting_peer"
            ? "Waiting for guest"
            : status === "connecting"
              ? "Connecting"
              : "Not connected"}
      </span>
    </header>
  );
}
