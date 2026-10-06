"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { Icon } from "./Icon";
import { EmptyWorkspace, WorkspaceLoading } from "./EmptyWorkspace";
import { CantonDappLedgerClient } from "@/lib/canton-dapp-ledger-client";
import {
  readRooms,
  roomUrl,
  shortId,
  assetName,
  type RoomBookmark,
} from "@/lib/workspace";
import type { CantonCreatedContract } from "../../../src/canton/ledger-client";
const labels: Record<string, string> = {
  DealProposal: "Awaiting acceptance",
  DealAgreement: "Accepted · not funded",
  DealEscrow: "Escrow funded",
  DealFulfillment: "Delivery submitted",
  DealRevisionRequest: "Revision requested",
  FulfillmentApproval: "Work approved",
  SettlementReceipt: "Settled",
};
export function DealsList({ compact = false }: { compact?: boolean }) {
  const { session, loading: walletLoading } = useWallet();
  const [items, setItems] = useState<CantonCreatedContract[]>([]),
    [rooms, setRooms] = useState<RoomBookmark[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let stopped = false;
    setItems([]);
    setError("");
    if (!session) return;
    setLoading(true);
    setRooms(readRooms(session.partyId));
    void (async () => {
      try {
        const ledger = await CantonDappLedgerClient.connect(session.partyId);
        const contracts = await ledger.queryActiveContracts(session.partyId);
        const latest = new Map<string, CantonCreatedContract>();
        for (const c of contracts) {
          const name = c.templateId.split(":").at(-1) || "",
            a = c.createArgument;
          if (
            !c.templateId.includes(":Vinss.Deal:") ||
            !labels[name] ||
            typeof a.dealId !== "string" ||
            (a.seller !== session.partyId && a.buyer !== session.partyId)
          )
            continue;
          const prev = latest.get(a.dealId);
          if (!prev || c.offset > prev.offset) latest.set(a.dealId, c);
        }
        if (!stopped)
          setItems(
            [...latest.values()].sort((a, b) =>
              a.offset > b.offset ? -1 : a.offset < b.offset ? 1 : 0,
            ),
          );
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!stopped) setLoading(false);
      }
    })();
    return () => {
      stopped = true;
    };
  }, [session?.partyId, revision]);
  if (walletLoading || loading) return <WorkspaceLoading />;
  if (error)
    return (
      <div className="surface padded stack">
        <div className="ui-alert error" role="alert">
          {error}
        </div>
        <button className="ui-button" onClick={() => setRevision((v) => v + 1)}>
          <Icon name="refresh" />
          Retry
        </button>
      </div>
    );
  if (!session || !items.length)
    return (
      <div className="surface">
        <EmptyWorkspace kind="deals" compact={compact} />
      </div>
    );
  return (
    <div className="deal-list">
      {items.slice(0, compact ? 2 : 200).map((c) => {
        const a = c.createArgument,
          name = c.templateId.split(":").at(-1) || "",
          room = rooms.find((r) => r.id === a.conversationId);
        return (
          <article key={c.contractId} className="surface deal-row">
            <div>
              <span
                className={
                  "badge " +
                  (name === "SettlementReceipt" || name === "DealEscrow"
                    ? "green"
                    : "")
                }
              >
                {labels[name]}
              </span>
              <h3>{room?.title || "Private agreement"}</h3>
              <p className="small muted">{shortId(String(a.dealId))}</p>
            </div>
            <div>
              <div className="deal-amount">
                {String(a.amount)}{" "}
                <small>{assetName(String(a.instrumentId))}</small>
              </div>
              {room ? (
                <Link href={roomUrl(room)} className="text-link">
                  Open private room
                  <Icon name="arrow" />
                </Link>
              ) : (
                <span className="small muted">
                  Reopen using the original invite
                </span>
              )}
            </div>
            {!compact && (
              <details
                className="advanced"
                style={{ width: "100%", marginTop: 0 }}
              >
                <summary>Ledger record</summary>
                <p className="mono break-word advanced-content">
                  {c.contractId}
                </p>
              </details>
            )}
          </article>
        );
      })}
      {!compact && (
        <button className="ui-button" onClick={() => setRevision((v) => v + 1)}>
          <Icon name="refresh" />
          Refresh from Canton
        </button>
      )}
    </div>
  );
}
