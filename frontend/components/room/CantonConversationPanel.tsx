"use client";

import type {
  KeyboardEvent,
} from "react";

import type {
  CantonRoomMessage,
  CantonRoomOffer,
  CantonRoomOfferInput,
  CantonRoomStatus,
} from "@/lib/canton-room-runtime";

interface Props {
  messages:
    readonly CantonRoomMessage[];
  offers:
    readonly CantonRoomOffer[];
  onCreateOffer(
    input: CantonRoomOfferInput,
  ): Promise<boolean>;
  onAcceptOffer(
    offer: CantonRoomOffer,
  ):
    | void
    | Promise<void>;
  onRejectOffer(
    offer: CantonRoomOffer,
  ):
    | void
    | Promise<void>;
  draft: string;
  busy: boolean;
  configured: boolean;
  status:
    | CantonRoomStatus
    | "idle";
  peerLabel: string;
  onDraftChange(
    value: string,
  ): void;
  onSend():
    | void
    | Promise<void>;
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
  draft,
  busy,
  configured,
  status,
  peerLabel,
  onDraftChange,
  onSend,
}: Props) {
  const ready =
    configured &&
    status === "ready";

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
        0 ? (
          <div className="m-auto max-w-sm text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-signal/[0.045] text-signal/55 ring-1 ring-signal/12">
              <ShieldIcon />
            </div>

            <p className="mt-4 text-[13px] font-medium text-paper/62">
              Start the conversation
            </p>

            <p className="mt-2 text-[10px] leading-5 text-paper/28">
              Messages are encrypted by OpenMLS before they leave this device.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map(
              (message) => (
                <li
                  key={
                    message.id
                  }
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
                        {
                          message.text
                        }
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
                              hour:
                                "2-digit",
                              minute:
                                "2-digit",
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
            disabled
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
              Transport
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
                  event.target
                    .value,
                )
              }
              onKeyDown={
                keyDown
              }
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
