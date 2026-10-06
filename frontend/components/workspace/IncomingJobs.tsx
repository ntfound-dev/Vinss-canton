"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "./WalletProvider";
import { CantonDappLedgerClient } from "@/lib/canton-dapp-ledger-client";
import { incomingJobRooms } from "@/lib/job-conversations";
import {
  readRooms,
  rememberRoom,
  roomUrl,
  shortId,
  type RoomBookmark,
} from "@/lib/workspace";
import { Icon } from "./Icon";
export function IncomingJobs() {
  const { session } = useWallet(),
    router = useRouter();
  const [rows, setRows] = useState<RoomBookmark[]>([]);
  useEffect(() => {
    setRows([]);
    if (!session) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const ledger = await CantonDappLedgerClient.connect(session!.partyId);
        const data = incomingJobRooms(
            await ledger.queryActiveContracts(session!.partyId),
            session!.partyId,
          ),
          existing = readRooms(session!.partyId);
        if (!stopped)
          setRows(data.filter((r) => !existing.some((x) => x.id === r.id)));
      } catch {
        /* Deals view exposes explicit ledger errors; retry incoming requests quietly. */
      }
      if (!stopped) timer = setTimeout(() => void poll(), 20000);
    }
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [session?.partyId]);
  if (!rows.length || !session) return null;
  return (
    <section style={{ marginBottom: 26 }}>
      <div className="section-heading">
        <h2>New job discussions</h2>
        <span className="badge">{rows.length} requests</span>
      </div>
      <div className="surface">
        {rows.map((r) => (
          <div key={r.id} className="room-row">
            <span className="avatar">
              <Icon name="jobs" />
            </span>
            <div className="room-copy">
              <h3>Someone wants to discuss your job</h3>
              <small>{shortId(r.peerParty)}</small>
            </div>
            <button
              className="ui-button"
              onClick={() => {
                rememberRoom(session.partyId, r);
                router.push(roomUrl(r));
              }}
            >
              Open chat
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
