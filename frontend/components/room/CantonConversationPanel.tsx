"use client";

import {
  useState,
  type KeyboardEvent,
} from "react";

import {
  INITIAL_OFFER_VALUES,
  VINSS_OFFER_TEMPLATES,
  offerSummary,
  offerTemplateById,
  offerTemplateForDealType,
  type VinssOfferTemplateId,
} from "@/lib/canton-offer-templates";

import type {
  CantonRoomMessage,
  CantonRoomOffer,
  CantonRoomOfferInput,
  CantonRoomStatus,
} from "@/lib/canton-room-runtime";

interface Props {
  messages: readonly CantonRoomMessage[];
  offers: readonly CantonRoomOffer[];
  onCreateOffer(
    input: CantonRoomOfferInput,
  ): Promise<boolean>;
  onAcceptOffer(
    offer: CantonRoomOffer,
  ): void | Promise<void>;
  onRejectOffer(
    offer: CantonRoomOffer,
  ): void | Promise<void>;
  draft: string;
  busy: boolean;
  configured: boolean;
  status: CantonRoomStatus | "idle";
  peerLabel: string;
  onDraftChange(value: string): void;
  onSend(): void | Promise<void>;
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        d="M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m9.3 12 1.8 1.8 3.7-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActionIcon({
  kind,
}: {
  kind:
    | "file"
    | "offer"
    | "escrow"
    | "agent";
}) {
  return (
    <svg
      className="h-[17px] w-[17px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "file" && (
        <>
          <path d="M7 3.8h7l4 4V20H7Z" />
          <path d="M14 3.8V8h4M10 12h5M10 15.5h5" />
        </>
      )}
      {kind === "offer" && (
        <>
          <path d="m12 3.8 6.8 8.2-6.8 8.2L5.2 12 12 3.8Z" />
          <path d="M9 12h6" />
        </>
      )}
      {kind === "escrow" && (
        <>
          <path d="M12 3.6 18.5 6v5c0 4-2.4 7-6.5 9-4.1-2-6.5-5-6.5-9V6L12 3.6Z" />
          <rect x="9.2" y="10.3" width="5.6" height="4.5" rx="1" />
        </>
      )}
      {kind === "agent" && (
        <>
          <path d="m12 3.5 1.65 4.85L18.5 10l-4.85 1.65L12 16.5l-1.65-4.85L5.5 10l4.85-1.65L12 3.5Z" />
          <path d="m18.2 15.2.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z" />
        </>
      )}
    </svg>
  );
}

export function CantonConversationPanel({
  messages,
  offers,
  draft,
  busy,
  configured,
  status,
  peerLabel,
  onDraftChange,
  onSend,
  onCreateOffer,
  onAcceptOffer,
  onRejectOffer,
}: Props) {
  const ready =
    configured &&
    status === "ready";

  const [
    offerOpen,
    setOfferOpen,
  ] = useState(false);

  const [
    templateId,
    setTemplateId,
  ] =
    useState<VinssOfferTemplateId>(
      "freelance",
    );

  const [
    offerValues,
    setOfferValues,
  ] = useState<Record<string, string>>({
    ...INITIAL_OFFER_VALUES,
  });

  const [
    expiresInHours,
    setExpiresInHours,
  ] = useState("24");

  const template =
    offerTemplateById(templateId);

  const requiredReady =
    template.fields
      .filter(
        (field) =>
          !field.optional,
      )
      .every(
        (field) =>
          Boolean(
            offerValues[
              field.id
            ]?.trim(),
          ),
      );

  function keyDown(
    event:
      KeyboardEvent<
        HTMLTextAreaElement
      >,
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (
        ready &&
        !busy &&
        draft.trim()
      ) {
        void onSend();
      }
    }
  }

  async function submitOffer() {
    if (
      !ready ||
      busy ||
      !requiredReady
    ) {
      return;
    }

    const fields:
      Record<string, string> =
      {};

    for (
      const field
      of template.fields
    ) {
      const value =
        offerValues[
          field.id
        ]?.trim();

      if (value) {
        fields[field.id] =
          value;
      }
    }

    const expiry =
      Number(expiresInHours);

    const created =
      await onCreateOffer({
        dealType:
          template.dealType,
        amount:
          fields[
            template.amountField
          ] ?? "",
        instrumentId:
          fields[
            template.assetField
          ] ?? "",
        terms:
          offerSummary(
            template,
            fields,
          ),
        fields,
        settlementRail:
          "canton",
        expiresInHours:
          Number.isFinite(
            expiry,
          )
            ? expiry
            : 24,
      });

    if (created) {
      setOfferValues({
        ...INITIAL_OFFER_VALUES,
      });
      setExpiresInHours("24");
      setOfferOpen(false);
    }
  }

  const actionClass =
    "group flex h-11 items-center gap-2.5 rounded-xl border border-wire/60 bg-vault/35 px-3 text-[10px] font-medium text-paper/55 transition disabled:cursor-not-allowed disabled:opacity-25";

  return (
    <section className="space-y-0">
      <div className="rounded-t-2xl border border-b-0 border-wire/70 bg-vault/25">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-paper/72">
              Private messages
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[10px] text-paper/30">
              <ShieldIcon />
              E2E protected
            </p>
          </div>

          <span className="rounded-full border border-signal/15 bg-signal/[0.035] px-2.5 py-1 text-[8px] uppercase tracking-[0.12em] text-signal/65">
            OpenMLS
          </span>
        </div>
      </div>

      <div className="border-x border-wire/70 bg-[#070c10]/95 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal/[0.06] text-signal/65 ring-1 ring-signal/15">
            <ShieldIcon />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-paper/70">
              {configured
                ? peerLabel
                : "Secure peer not selected"}
            </p>
            <p className="mt-0.5 text-[9px] text-paper/28">
              Canton private delivery
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex min-h-[390px] max-h-[58vh] flex-col overflow-y-auto border-x border-wire/70 bg-black/10 px-3 py-4 sm:px-4">
        {messages.length ===
          0 &&
        offers.length ===
          0 ? (
          <div className="m-auto max-w-sm text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-signal/[0.045] text-signal/55 ring-1 ring-signal/12">
              <ShieldIcon />
            </div>
            <p className="mt-4 text-[13px] font-medium text-paper/62">
              Start the conversation
            </p>
            <p className="mt-2 text-[10px] leading-5 text-paper/28">
              Messages and structured offers are encrypted by OpenMLS before they leave this device.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {offers.map(
              (offer) => {
                const definition =
                  offerTemplateForDealType(
                    offer.dealType,
                  );

                const details =
                  definition.fields.filter(
                    (field) =>
                      field.id !==
                        definition.amountField &&
                      field.id !==
                        definition.assetField &&
                      Boolean(
                        offer.fields[
                          field.id
                        ],
                      ),
                  );

                return (
                  <div
                    key={offer.dealId}
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
                        <span className="text-[9px] text-paper/38">
                          {offer.status}
                        </span>
                      </div>

                      <p className="mt-2 text-[13px] font-medium text-paper/75">
                        {offer.terms}
                      </p>

                      <p className="mt-1 text-[15px] text-paper/86">
                        {offer.amount}{" "}
                        {offer.instrumentId}
                      </p>

                      {details.length >
                        0 && (
                        <div className="mt-3 space-y-1.5 border-t border-wire/50 pt-2.5">
                          {details.map(
                            (field) => (
                              <p
                                key={field.id}
                                className="text-[10px] leading-relaxed text-paper/48"
                              >
                                <span className="text-paper/28">
                                  {field.label}
                                </span>
                                {" · "}
                                <span className="text-paper/58">
                                  {
                                    offer.fields[
                                      field.id
                                    ]
                                  }
                                </span>
                              </p>
                            ),
                          )}
                        </div>
                      )}

                      {!offer.own &&
                        offer.status ===
                          "pending" && (
                          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-wire/55 pt-3">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void onRejectOffer(
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
                                void onAcceptOffer(
                                  offer,
                                )
                              }
                              className="h-9 rounded-lg border border-signal/35 text-[8px] uppercase tracking-[0.13em] text-signal disabled:opacity-30"
                            >
                              Accept
                            </button>
                          </div>
                        )}

                      {offer.status ===
                        "accepted" && (
                        <div className="mt-3 border-t border-signal/20 pt-2.5 text-[9px] text-signal/70">
                          DealAgreement
                          {offer.agreementContractId
                            ? ` · ${shortId(
                                offer.agreementContractId,
                              )}`
                            : " · accepted"}
                        </div>
                      )}

                      {offer.status ===
                        "rejected" && (
                        <div className="mt-3 border-t border-danger/15 pt-2.5 text-[9px] text-danger/70">
                          Offer rejected
                        </div>
                      )}
                    </div>
                  </div>
                );
              },
            )}

            {messages.length >
              0 && (
              <ul className="space-y-3">
                {messages.map(
                  (message) => (
                    <li
                      key={message.id}
                      className={
                        message.own
                          ? "flex justify-end"
                          : "flex justify-start"
                      }
                    >
                      <div className="max-w-[88%] sm:max-w-[78%]">
                        <div
                          className={
                            message.own
                              ? "rounded-2xl rounded-br-md bg-signal/[0.075] px-3.5 py-2.5 ring-1 ring-signal/22"
                              : "rounded-2xl rounded-bl-md bg-vault/45 px-3.5 py-2.5 ring-1 ring-wire/55"
                          }
                        >
                          <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-paper/88">
                            {message.text}
                          </p>
                          <div
                            className={
                              message.own
                                ? "mt-1.5 flex items-center justify-end gap-1.5 text-[9px] text-paper/28"
                                : "mt-1.5 flex items-center justify-start gap-1.5 text-[9px] text-paper/28"
                            }
                          >
                            <span>
                              {new Date(
                                message.sentAt,
                              ).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                            <span>·</span>
                            <span
                              className="text-signal/55"
                              title="End-to-end encrypted"
                            >
                              <ShieldIcon />
                            </span>
                            {message.own && (
                              <span className="text-signal/70">
                                ✓
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        )}
      </div>

      <section className="border-x border-wire/70 bg-[#070c10]/95 px-3 py-2.5">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-signal/70 shadow-[0_0_10px_rgba(94,234,212,0.45)]" />
          <span className="text-[8px] uppercase tracking-[0.16em] text-paper/36">
            Actions
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            disabled
            className={actionClass}
          >
            <ActionIcon kind="file" />
            File
          </button>

          <button
            type="button"
            onClick={() =>
              setOfferOpen(
                (value) => !value,
              )
            }
            disabled={
              !ready ||
              busy
            }
            className={actionClass}
          >
            <ActionIcon kind="offer" />
            Offer
          </button>

          <button
            disabled
            className={actionClass}
          >
            <ActionIcon kind="escrow" />
            Escrow
          </button>

          <button
            disabled
            className={`${actionClass} border-signal/15 bg-signal/[0.04] text-signal/60`}
          >
            <ActionIcon kind="agent" />
            VINSS Agent
          </button>
        </div>

        {offerOpen && (
          <div className="mt-3 rounded-xl border border-wire/65 bg-black/15 p-3">
            <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
              <select
                value={templateId}
                onChange={(event) =>
                  setTemplateId(
                    event.target
                      .value as VinssOfferTemplateId,
                  )
                }
                disabled={busy}
                className="h-10 rounded-lg border border-wire/65 bg-[#080d12] px-3 text-[11px] text-paper/75 outline-none"
              >
                {VINSS_OFFER_TEMPLATES.map(
                  (option) => (
                    <option
                      key={option.id}
                      value={option.id}
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>

              <p className="self-center text-[9px] leading-4 text-paper/34">
                {template.description}
              </p>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {template.fields.map(
                (field) => {
                  const value =
                    offerValues[
                      field.id
                    ] ?? "";

                  const setValue =
                    (next: string) =>
                      setOfferValues(
                        (current) => ({
                          ...current,
                          [field.id]:
                            next,
                        }),
                      );

                  if (
                    field.type ===
                    "choice"
                  ) {
                    return (
                      <label
                        key={field.id}
                        className="space-y-1"
                      >
                        <span className="text-[8px] uppercase tracking-[0.11em] text-paper/32">
                          {field.label}
                        </span>
                        <select
                          value={value}
                          onChange={(event) =>
                            setValue(
                              event.target
                                .value,
                            )
                          }
                          className="h-10 w-full rounded-lg border border-wire/65 bg-[#080d12] px-3 text-[11px] text-paper/75 outline-none"
                        >
                          {field.choices?.map(
                            (choice) => (
                              <option
                                key={choice.value}
                                value={choice.value}
                              >
                                {choice.label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    );
                  }

                  if (
                    field.type ===
                    "textarea"
                  ) {
                    return (
                      <label
                        key={field.id}
                        className="space-y-1 sm:col-span-2"
                      >
                        <span className="text-[8px] uppercase tracking-[0.11em] text-paper/32">
                          {field.label}
                          {field.optional
                            ? " · optional"
                            : ""}
                        </span>
                        <textarea
                          rows={2}
                          value={value}
                          onChange={(event) =>
                            setValue(
                              event.target
                                .value,
                            )
                          }
                          placeholder={
                            field.placeholder
                          }
                          className="w-full resize-none rounded-lg border border-wire/65 bg-[#080d12] px-3 py-2.5 text-[11px] text-paper/75 outline-none placeholder:text-paper/20"
                        />
                      </label>
                    );
                  }

                  return (
                    <label
                      key={field.id}
                      className="space-y-1"
                    >
                      <span className="text-[8px] uppercase tracking-[0.11em] text-paper/32">
                        {field.label}
                        {field.optional
                          ? " · optional"
                          : ""}
                      </span>
                      <input
                        type={
                          field.type ===
                          "number"
                            ? "number"
                            : "text"
                        }
                        value={value}
                        onChange={(event) =>
                          setValue(
                            event.target
                              .value,
                          )
                        }
                        placeholder={
                          field.placeholder
                        }
                        className="h-10 w-full rounded-lg border border-wire/65 bg-[#080d12] px-3 text-[11px] text-paper/75 outline-none placeholder:text-paper/20"
                      />
                    </label>
                  );
                },
              )}

              <label className="space-y-1">
                <span className="text-[8px] uppercase tracking-[0.11em] text-paper/32">
                  Offer expiry · hours
                </span>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={expiresInHours}
                  onChange={(event) =>
                    setExpiresInHours(
                      event.target.value,
                    )
                  }
                  className="h-10 w-full rounded-lg border border-wire/65 bg-[#080d12] px-3 text-[11px] text-paper/75 outline-none"
                />
              </label>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setOfferOpen(false)
                }
                disabled={busy}
                className="h-9 rounded-lg border border-wire/65 px-3 text-[8px] uppercase tracking-[0.12em] text-paper/45 disabled:opacity-30"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void submitOffer()
                }
                disabled={
                  !requiredReady ||
                  busy
                }
                className="h-9 rounded-lg border border-signal/35 px-3 text-[8px] uppercase tracking-[0.12em] text-signal disabled:opacity-30"
              >
                {busy
                  ? "Creating…"
                  : "Create Offer"}
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="rounded-b-2xl border border-t-0 border-wire/70 bg-[#080d12]/95 p-2.5 shadow-[0_-18px_45px_rgba(0,0,0,0.16)]">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-wire/55 bg-black/15 px-3 py-2">
            <p className="text-[7px] uppercase tracking-[0.14em] text-paper/32">
              Privacy
            </p>
            <p className="mt-1 text-[9px] text-paper/52">
              OpenMLS E2E
            </p>
          </div>

          <div className="rounded-xl border border-wire/55 bg-black/15 px-3 py-2">
            <p className="text-[7px] uppercase tracking-[0.14em] text-paper/32">
              Agreement rail
            </p>
            <p className="mt-1 text-[9px] text-paper/52">
              Canton
            </p>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1 rounded-xl border border-wire/65 bg-black/15 transition focus-within:border-signal/30">
            <textarea
              value={draft}
              onChange={(event) =>
                onDraftChange(
                  event.target.value,
                )
              }
              onKeyDown={keyDown}
              rows={1}
              disabled={
                !ready ||
                busy
              }
              placeholder={
                ready
                  ? `Message ${peerLabel}…`
                  : configured
                    ? "Secure session connecting…"
                    : "Select or join a private peer first…"
              }
              className="max-h-28 min-h-11 w-full resize-none overflow-y-auto bg-transparent px-3 py-3 text-sm leading-5 text-paper outline-none placeholder:text-paper/20 disabled:opacity-40"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              void onSend()
            }
            disabled={
              !ready ||
              busy ||
              !draft.trim()
            }
            className="h-11 rounded-xl border border-signal/30 bg-signal/[0.07] px-4 text-[9px] uppercase tracking-[0.14em] text-signal transition hover:bg-signal hover:text-ink disabled:bg-transparent disabled:opacity-30"
          >
            {busy
              ? "Sending…"
              : "Send"}
          </button>
        </div>
      </div>
    </section>
  );
}

function shortId(
  value: string,
): string {
  if (
    value.length <= 20
  ) {
    return value;
  }

  return `${value.slice(
    0,
    9,
  )}…${value.slice(-7)}`;
}
