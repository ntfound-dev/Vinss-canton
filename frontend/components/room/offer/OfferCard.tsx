"use client";
import { useState } from "react";
import { offerTemplateForDealType } from "@/lib/canton-offer-templates";
import type { CantonRoomOffer } from "@/lib/canton-room-runtime";
import { assetName, escrowState } from "@/lib/workspace";
import { Icon } from "@/components/workspace/Icon";
export interface OfferCardProps {
  offer: CantonRoomOffer;
  busy: boolean;
  onAccept(offer: CantonRoomOffer): void | Promise<void>;
  onReject(offer: CantonRoomOffer): void | Promise<void>;
  onSubmitFulfillment(
    offer: CantonRoomOffer,
    proof: string,
  ): void | Promise<void>;
  onRequestRevision(offer: CantonRoomOffer, note: string): void | Promise<void>;
  onSubmitRevision(offer: CantonRoomOffer, proof: string): void | Promise<void>;
  onApproveFulfillment(offer: CantonRoomOffer): void | Promise<void>;
  onSettle(offer: CantonRoomOffer): void | Promise<void>;
}
export function OfferCard({
  offer: o,
  busy,
  onAccept,
  onReject,
  onSubmitFulfillment,
  onRequestRevision,
  onSubmitRevision,
  onApproveFulfillment,
  onSettle,
}: OfferCardProps) {
  const [proof, setProof] = useState(""),
    [note, setNote] = useState(""),
    [confirm, setConfirm] = useState(false);
  const state = escrowState(o),
    life = o.lifecycle ?? (o.status === "accepted" ? "accepted" : "proposal"),
    expired = o.status === "pending" && Date.parse(o.expiresAt) <= Date.now();
  const needsFunding = Boolean(o.instrumentAdmin) && o.status === "accepted" && life === "accepted" && !o.escrowContractId;
  const canSubmit = o.own && o.status === "accepted" && life === "accepted" && !needsFunding,
    canReview = !o.own && o.status === "accepted" && life === "submitted",
    canRevise =
      o.own && o.status === "accepted" && life === "revision_requested",
    canSettle =
      o.own &&
      o.status === "accepted" &&
      life === "approved" &&
      Boolean(o.instrumentAdmin);
  return (
    <article className={"offer-card" + (o.own ? " own" : "")}>
      <div className="offer-top">
        <span className="text-link">
          <Icon name="file" />
          {offerTemplateForDealType(o.dealType).label}
        </span>
        <span className={"badge " + state.tone}>
          {expired ? "Offer expired" : state.label}
        </span>
      </div>
      <h3>{o.terms}</h3>
      <div className="deal-amount">
        {o.amount} <small>{assetName(o.instrumentId)}</small>
      </div>
      <p className="small muted">
        {o.instrumentAdmin ? "Canton escrow / rekber" : "Canton agreement"}
      </p>
      {o.status === "accepted" && (
        <>
          <div className="escrow-track" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((s) => (
              <span key={s} className={s <= state.step ? "done" : ""} />
            ))}
          </div>
          <p className="small muted">
            {
              [
                "Offer received",
                "Agreement accepted",
                "Escrow funded",
                "Delivery & review",
                "Approved for settlement",
                "Settlement complete",
              ][state.step]
            }
          </p>
        </>
      )}
      {!o.own && o.status === "pending" && !expired && (
        <>
          <div className="actions">
            <button
              className="ui-button danger"
              disabled={busy}
              onClick={() => void onReject(o)}
            >
              Decline
            </button>
            <button
              className="ui-button primary"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              {o.instrumentAdmin ? "Accept & fund" : "Accept offer"}
            </button>
          </div>
          {confirm && (
            <div className="stack offer-foot">
              <p>
                {o.instrumentAdmin
                  ? "Your wallet will be asked to accept this agreement and allocate " +
                    o.amount +
                    " " +
                    assetName(o.instrumentId) +
                    " to escrow. Payment releases after approval and settlement."
                  : "Accept this agreement on Canton. This offer does not include funded escrow."}
              </p>
              <button
                className="ui-button primary"
                disabled={busy}
                onClick={() => void onAccept(o)}
              >
                {busy ? "Waiting for wallet…" : "Confirm in wallet"}
              </button>
              <button
                className="text-link"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}
      {needsFunding && !o.own && (
        <div className="stack offer-foot">
          <p>Agreement accepted. Funding is still required before work can be submitted.</p>
          <button className="ui-button primary" disabled={busy} onClick={() => void onAccept(o)}>
            {busy ? "Waiting for wallet…" : "Retry escrow funding"}
          </button>
        </div>
      )}
      {(canSubmit || canRevise) && (
        <>
          <label className="field">
            {canRevise ? "Revised delivery" : "Deliver your work"}
            <textarea
              rows={3}
              disabled={busy}
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              placeholder="Describe the delivery and include your work link."
            />
          </label>
          <div className="actions">
            <button
              className="ui-button primary"
              disabled={busy || !proof.trim()}
              onClick={() =>
                void (canRevise
                  ? onSubmitRevision(o, proof)
                  : onSubmitFulfillment(o, proof))
              }
            >
              {busy
                ? "Submitting…"
                : canRevise
                  ? "Submit revision"
                  : "Submit work"}
            </button>
          </div>
        </>
      )}
      {canReview && (
        <>
          <label className="field">
            Revision notes <span className="muted small">(if needed)</span>
            <textarea
              rows={2}
              disabled={busy}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What needs to change?"
            />
          </label>
          <div className="actions">
            <button
              className="ui-button"
              disabled={busy || !note.trim()}
              onClick={() => void onRequestRevision(o, note)}
            >
              Request revision
            </button>
            <button
              className="ui-button primary"
              disabled={busy}
              onClick={() => void onApproveFulfillment(o)}
            >
              Approve work
            </button>
          </div>
        </>
      )}
      {canSettle && (
        <div className="actions">
          <button
            className="ui-button primary"
            disabled={busy}
            onClick={() => void onSettle(o)}
          >
            <Icon name="shield" />
            {busy ? "Settling…" : "Settle escrow"}
          </button>
        </div>
      )}
      <div className="offer-foot">
        {o.status === "rejected"
          ? "This offer was declined."
          : life === "settled"
            ? "Settlement completed on Canton."
            : life === "approved"
              ? o.instrumentAdmin
                ? "Work approved. The payee can complete settlement."
                : "Work approved. This agreement has no escrow to settle."
              : o.status === "accepted" && o.instrumentAdmin && !state.funded
                ? "Escrow funding has not been confirmed in this view. Open the deal record to check its current ledger state."
                : o.status === "pending"
                  ? "Review the terms before accepting."
                  : "The next action depends on the current agreement state."}
      </div>
      <details className="advanced">
        <summary>Agreement details</summary>
        <div className="advanced-content small muted break-word">
          <p>Deal: {o.dealId}</p>
          <p>Network: Canton · Asset: {assetName(o.instrumentId)}</p>
          <p>Offer expiry: {new Date(o.expiresAt).toLocaleString()}</p>
          <p>
            Contract:{" "}
            {o.settlementReceiptContractId ||
              o.approvalContractId ||
              o.escrowContractId ||
              o.agreementContractId ||
              o.contractId}
          </p>
        </div>
      </details>
    </article>
  );
}
