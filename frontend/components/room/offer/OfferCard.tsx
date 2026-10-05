"use client";

import {
  offerTemplateForDealType,
} from "@/lib/canton-offer-templates";

import type { CantonRoomOffer } from "@/lib/canton-room-runtime";

interface OfferCardProps {
  offer: CantonRoomOffer;
  busy: boolean;
  onAccept(offer: CantonRoomOffer): void | Promise<void>;
  onReject(offer: CantonRoomOffer): void | Promise<void>;
}

function shortId(value: string): string {
  if (value.length <= 20) {
    return value;
  }

  return `\( {value.slice(0, 9)}… \){value.slice(-7)}`;
}

export function OfferCard({
  offer,
  busy,
  onAccept,
  onReject,
}: OfferCardProps) {
  const definition = offerTemplateForDealType(
    offer.dealType,
  );

  const details = definition.fields.filter(
    (field) =>
      field.id !== definition.amountField &&
      field.id !== definition.assetField &&
      Boolean(offer.fields[field.id]),
  );

  const statusLabel =
    offer.status === "pending"
      ? "Pending"
      : offer.status === "accepted"
        ? "Accepted"
        : "Rejected";

  const statusClass =
    offer.status === "pending"
      ? "text-amber-300/75"
      : offer.status === "accepted"
        ? "text-signal/75"
        : "text-danger/75";

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
          <span className={`text-[9px] ${statusClass}`}>
            {statusLabel}
          </span>
        </div>

        <p className="mt-2 text-[13px] font-medium text-paper/75">
          {offer.terms}
        </p>

        <p className="mt-1 text-[15px] text-paper/86">
          {offer.amount} {offer.instrumentId}
        </p>

        {details.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-wire/50 pt-2.5">
            {details.map((field) => (
              <p
                key={field.id}
                className="text-[10px] leading-relaxed text-paper/48"
              >
                <span className="text-paper/28">
                  {field.label}
                </span>
                {" · "}
                <span className="text-paper/58">
                  {offer.fields[field.id]}
                </span>
              </p>
            ))}
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[8px] text-paper/28">
          <span>
            Expires{" "}
            {new Date(offer.expiresAt).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {offer.own && (
            <span className="text-paper/22">· Your offer</span>
          )}
        </div>

        {!offer.own && offer.status === "pending" && (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-wire/55 pt-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onReject(offer)}
              className="h-9 rounded-lg border border-danger/30 text-[8px] uppercase tracking-[0.13em] text-danger disabled:opacity-30"
            >
              Reject
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void onAccept(offer)}
              className="h-9 rounded-lg border border-signal/35 bg-signal/[0.06] text-[8px] uppercase tracking-[0.13em] text-signal disabled:opacity-30"
            >
              Accept
            </button>
          </div>
        )}

        {offer.status === "accepted" && (
          <div className="mt-3 border-t border-signal/20 pt-2.5 text-[9px] text-signal/70">
            {offer.instrumentAdmin
              ? "Canton Token Standard escrow"
              : "DealAgreement"}

            {offer.instrumentAdmin
              ? offer.escrowContractId
                ? ` · ${shortId(offer.escrowContractId)}`
                : " · funded"
              : offer.agreementContractId
                ? ` · ${shortId(offer.agreementContractId)}`
                : " · accepted"}
          </div>
        )}

        {offer.status === "rejected" && (
          <div className="mt-3 border-t border-danger/15 pt-2.5 text-[9px] text-danger/70">
            Offer rejected
          </div>
        )}
      </div>
    </div>
  );
}
