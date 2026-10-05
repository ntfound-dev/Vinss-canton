"use client";

import {
  useState,
} from "react";

import {
  offerTemplateForDealType,
} from "@/lib/canton-offer-templates";

import type {
  CantonRoomOffer,
} from "@/lib/canton-room-runtime";

interface OfferCardProps {
  offer: CantonRoomOffer;
  busy: boolean;

  onAccept(
    offer: CantonRoomOffer,
  ): void | Promise<void>;

  onReject(
    offer: CantonRoomOffer,
  ): void | Promise<void>;

  onSubmitFulfillment(
    offer: CantonRoomOffer,
    proof: string,
  ): void | Promise<void>;

  onRequestRevision(
    offer: CantonRoomOffer,
    note: string,
  ): void | Promise<void>;

  onSubmitRevision(
    offer: CantonRoomOffer,
    proof: string,
  ): void | Promise<void>;

  onApproveFulfillment(
    offer: CantonRoomOffer,
  ): void | Promise<void>;

  onSettle(
    offer: CantonRoomOffer,
  ): void | Promise<void>;
}

function assetLabel(
  value:
    string,
): string {
  return value === "Amulet"
    ? "CC"
    : value;
}

export function OfferCard({
  offer,
  busy,
  onAccept,
  onReject,
  onSubmitFulfillment,
  onRequestRevision,
  onSubmitRevision,
  onApproveFulfillment,
  onSettle,
}: OfferCardProps) {
  const [
    fulfillment,
    setFulfillment,
  ] = useState("");

  const [
    revisionNote,
    setRevisionNote,
  ] = useState("");

  const definition =
    offerTemplateForDealType(
      offer.dealType,
    );

  const lifecycle =
    offer.lifecycle ??
    (
      offer.status === "accepted"
        ? "accepted"
        : "proposal"
    );

  const canSubmit =
    offer.own &&
    offer.status === "accepted" &&
    lifecycle === "accepted";

  const canReview =
    !offer.own &&
    offer.status === "accepted" &&
    lifecycle === "submitted";

  const canRevise =
    offer.own &&
    offer.status === "accepted" &&
    lifecycle ===
      "revision_requested";

  const canSettle =
    offer.own &&
    offer.status === "accepted" &&
    lifecycle === "approved" &&
    Boolean(
      offer.instrumentAdmin,
    );

  const statusLabel =
    offer.status === "pending"
      ? "Pending"
      : offer.status === "rejected"
        ? "Rejected"
        : lifecycle === "submitted"
          ? "Fulfillment submitted"
          : lifecycle ===
              "revision_requested"
            ? "Revision requested"
            : lifecycle === "approved"
              ? "Approved"
              : lifecycle === "settled"
                ? "Settled"
                : offer.instrumentAdmin
                  ? "Escrow funded"
                  : "Accepted";

  return (
    <div
      className={
        offer.own
          ? "ml-auto w-[92%] max-w-md"
          : "mr-auto w-[92%] max-w-md"
      }
    >
      <div className="rounded-2xl border border-amber-400/20 bg-vault/45 px-3.5 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[8px] uppercase tracking-[0.14em] text-amber-300/70">
            {definition.label}
            {" · "}
            {offer.settlementRail}
          </span>

          <span className="text-[9px] text-signal/75">
            {statusLabel}
          </span>
        </div>

        <p className="mt-2 text-[13px] font-medium text-paper/75">
          {offer.terms}
        </p>

        <p className="mt-1 text-[15px] text-paper/86">
          {offer.amount}
          {" "}
          {assetLabel(
            offer.instrumentId,
          )}
        </p>

        {!offer.own &&
          offer.status === "pending" && (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-wire/55 pt-3">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void onReject(
                  offer,
                )
              }
              className="h-9 rounded-lg border border-danger/30 text-[8px] uppercase tracking-[0.13em] text-danger disabled:opacity-30"
            >
              Reject
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void onAccept(
                  offer,
                )
              }
              className="h-9 rounded-lg border border-signal/35 bg-signal/[0.06] text-[8px] uppercase tracking-[0.13em] text-signal disabled:opacity-30"
            >
              Accept
            </button>
          </div>
        )}

        {canSubmit && (
          <div className="mt-3 space-y-2 border-t border-wire/55 pt-3">
            <textarea
              rows={3}
              value={fulfillment}
              disabled={busy}
              onChange={(event) =>
                setFulfillment(
                  event.target.value,
                )
              }
              placeholder="Describe delivered work. Only the hash is committed on Canton."
              className="w-full resize-none rounded-lg border border-wire/60 bg-black/20 px-3 py-2 text-[10px] text-paper/70 outline-none"
            />

            <button
              type="button"
              disabled={
                busy ||
                !fulfillment.trim()
              }
              onClick={() =>
                void onSubmitFulfillment(
                  offer,
                  fulfillment,
                )
              }
              className="h-9 w-full rounded-lg border border-signal/35 bg-signal/[0.06] text-[8px] uppercase tracking-[0.13em] text-signal disabled:opacity-30"
            >
              Submit Fulfillment
            </button>
          </div>
        )}

        {canReview && (
          <div className="mt-3 space-y-2 border-t border-wire/55 pt-3">
            <textarea
              rows={2}
              value={revisionNote}
              disabled={busy}
              onChange={(event) =>
                setRevisionNote(
                  event.target.value,
                )
              }
              placeholder="Revision reason, if needed"
              className="w-full resize-none rounded-lg border border-wire/60 bg-black/20 px-3 py-2 text-[10px] text-paper/70 outline-none"
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={
                  busy ||
                  !revisionNote.trim()
                }
                onClick={() =>
                  void onRequestRevision(
                    offer,
                    revisionNote,
                  )
                }
                className="h-9 rounded-lg border border-amber-400/30 text-[8px] uppercase tracking-[0.12em] text-amber-300 disabled:opacity-30"
              >
                Request Revision
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void onApproveFulfillment(
                    offer,
                  )
                }
                className="h-9 rounded-lg border border-signal/35 bg-signal/[0.06] text-[8px] uppercase tracking-[0.12em] text-signal disabled:opacity-30"
              >
                Approve
              </button>
            </div>
          </div>
        )}

        {canRevise && (
          <div className="mt-3 space-y-2 border-t border-wire/55 pt-3">
            <textarea
              rows={3}
              value={fulfillment}
              disabled={busy}
              onChange={(event) =>
                setFulfillment(
                  event.target.value,
                )
              }
              placeholder="Describe revised fulfillment"
              className="w-full resize-none rounded-lg border border-wire/60 bg-black/20 px-3 py-2 text-[10px] text-paper/70 outline-none"
            />

            <button
              type="button"
              disabled={
                busy ||
                !fulfillment.trim()
              }
              onClick={() =>
                void onSubmitRevision(
                  offer,
                  fulfillment,
                )
              }
              className="h-9 w-full rounded-lg border border-signal/35 bg-signal/[0.06] text-[8px] uppercase tracking-[0.13em] text-signal disabled:opacity-30"
            >
              Submit Revision
            </button>
          </div>
        )}

        {canSettle && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onSettle(
                offer,
              )
            }
            className="mt-3 h-9 w-full rounded-lg border border-signal/40 bg-signal/[0.09] text-[8px] uppercase tracking-[0.13em] text-signal disabled:opacity-30"
          >
            Settle Escrow
          </button>
        )}

        {lifecycle === "approved" &&
          !offer.instrumentAdmin && (
          <p className="mt-3 border-t border-signal/15 pt-3 text-[9px] text-signal/70">
            Fulfillment approved.
          </p>
        )}

        {lifecycle === "settled" && (
          <p className="mt-3 border-t border-signal/20 pt-3 text-[9px] text-signal/75">
            Settlement complete on Canton.
          </p>
        )}

        {offer.status === "rejected" && (
          <p className="mt-3 border-t border-danger/15 pt-3 text-[9px] text-danger/70">
            Offer rejected.
          </p>
        )}
      </div>
    </div>
  );
}
