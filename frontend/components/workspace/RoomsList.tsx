"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { Icon } from "./Icon";
import { EmptyWorkspace, WorkspaceLoading } from "./EmptyWorkspace";
import {
  readRooms,
  roomUrl,
  shortId,
  type RoomBookmark,
} from "@/lib/workspace";
import {
  ownInvites,
  encodeInvite,
  type PrivateInvite,
} from "@/lib/canton-invite";
export function RoomsList({ compact = false }: { compact?: boolean }) {
  const { session, loading } = useWallet();
  const [rooms, setRooms] = useState<RoomBookmark[]>([]),
    [invites, setInvites] = useState<PrivateInvite[]>([]);
  useEffect(() => {
    const refresh = () => {
      setRooms(session ? readRooms(session.partyId) : []);
      setInvites(session ? ownInvites(session.partyId) : []);
    };
    refresh();
    window.addEventListener("vinss:rooms-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("vinss:rooms-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [session?.partyId]);
  const pending = invites.filter((i) => !rooms.some((r) => r.id === i.id));
  return (
    <>
      <div className="surface inbox-surface">
        {rooms.length ? (
          rooms.slice(0, compact ? 4 : 200).map((r) => (
            <Link className="room-row" href={roomUrl(r)} key={r.id}>
              <span className="avatar">
                {r.title.slice(0, 1).toUpperCase()}
              </span>
              <div className="room-copy">
                <h3>{r.title}</h3>
                <small>{shortId(r.peerParty)} · Private room</small>
              </div>
              <Icon name="arrow" />
            </Link>
          ))
        ) : loading ? (
          <WorkspaceLoading />
        ) : (
          <EmptyWorkspace kind="rooms" compact={compact} />
        )}
      </div>
      {pending.length > 0 && (
        <div className="section-spacer">
          <div className="section-heading">
            <h2>Waiting for a guest</h2>
          </div>
          <div className="surface">
            {pending.slice(0, compact ? 2 : 30).map((i) => (
              <Link
                key={i.id}
                href={`/invite#${encodeInvite(i)}`}
                className="room-row"
              >
                <span className="avatar">
                  <Icon name="link" />
                </span>
                <div className="room-copy">
                  <h3>{i.title}</h3>
                  <small>Guest hasn’t joined yet · open invite</small>
                </div>
                <span className="badge">Invite</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
