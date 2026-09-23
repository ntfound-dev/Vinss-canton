"use client";

import {
  useParams,
  useSearchParams,
} from "next/navigation";

import {
  useEffect,
  useState,
} from "react";

import {
  CantonRoomRuntime,
  type CantonRoomDealAction,
  type CantonRoomMessage,
  type CantonRoomOffer,
  type CantonRoomOfferInput,
  type CantonRoomStatus,
} from "@/lib/canton-room-runtime";

import {
  RoomHeader,
} from "@/components/room/RoomHeader";

import {
  RoomTabs,
  type RoomTab,
} from "@/components/room/RoomTabs";

import {
  CantonConversationPanel,
} from "@/components/room/CantonConversationPanel";

export default function RoomPage() {
  const params =
    useParams<{
      roomId: string;
    }>();

  const search =
    useSearchParams();

  const peerParty =
    search.get(
      "peerParty",
    );

  const peerInstallation =
    search.get(
      "peerInstallation",
    );

  const creator =
    search.get("mode") ===
    "creator";

  const [tab, setTab] =
    useState<RoomTab>(
      "message",
    );

  const [draft, setDraft] =
    useState("");

  const [runtime, setRuntime] =
    useState<
      CantonRoomRuntime |
      null
    >(null);

  const [status, setStatus] =
    useState<
      CantonRoomStatus |
      "idle"
    >("idle");

  const [messages, setMessages] =
    useState<
      CantonRoomMessage[]
    >([]);


  const [offers, setOffers] =
    useState<
      CantonRoomOffer[]
    >([]);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState<
      string |
      null
    >(null);

  useEffect(
    () => {
      if (
        !peerParty ||
        !peerInstallation
      ) {
        return;
      }

      let disposed =
        false;

      let active:
        CantonRoomRuntime |
        undefined;

      void CantonRoomRuntime
        .connect({
          conversationId:
            params.roomId,

          peerParty,

          peerInstallationId:
            peerInstallation,

          creator,

          onStatus:
            setStatus,

          onMessages(
            incoming,
          ) {
            if (
              disposed
            ) {
              return;
            }

            setMessages(
              (current) =>
                mergeMessages(
                  current,
                  incoming,
                ),
            );
          },

          onOffers(
            incoming,
          ) {
            if (
              disposed
            ) {
              return;
            }

            setOffers(
              (current) =>
                mergeOffers(
                  current,
                  incoming,
                ),
            );
          },

          onDealActions(
            actions,
          ) {
            if (
              disposed
            ) {
              return;
            }

            setOffers(
              (current) =>
                applyDealActions(
                  current,
                  actions,
                ),
            );
          },

          onError(
            cause,
          ) {
            if (
              !disposed
            ) {
              setError(
                cause.message,
              );
            }
          },
        })
        .then(
          (connected) => {
            if (
              disposed
            ) {
              connected.close();
              return;
            }

            active =
              connected;

            setRuntime(
              connected,
            );
          },
        )
        .catch(
          (cause:
            unknown) => {
            if (
              !disposed
            ) {
              setError(
                errorText(
                  cause,
                ),
              );
            }
          },
        );

      return () => {
        disposed =
          true;

        active?.close();
      };
    },
    [
      creator,
      params.roomId,
      peerInstallation,
      peerParty,
    ],
  );

  async function send() {
    if (
      !runtime ||
      status !== "ready" ||
      !draft.trim()
    ) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const message =
        await runtime
          .sendText(
            draft,
          );

      setMessages(
        (current) =>
          mergeMessages(
            current,
            [message],
          ),
      );

      setDraft("");
    } catch (
      cause
    ) {
      setError(
        errorText(
          cause,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function createOffer(
    input:
      CantonRoomOfferInput,
  ): Promise<boolean> {
    if (
      !runtime ||
      status !== "ready"
    ) {
      return false;
    }

    setBusy(true);
    setError(null);

    try {
      const offer =
        await runtime
          .createOffer(
            input,
          );

      setOffers(
        (current) =>
          mergeOffers(
            current,
            [offer],
          ),
      );

      return true;
    } catch (
      cause
    ) {
      setError(
        errorText(
          cause,
        ),
      );

      return false;
    } finally {
      setBusy(false);
    }
  }

  async function acceptOffer(
    offer:
      CantonRoomOffer,
  ): Promise<void> {
    if (!runtime) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const updated =
        await runtime
          .acceptOffer(
            offer,
          );

      setOffers(
        (current) =>
          mergeOffers(
            current,
            [updated],
          ),
      );
    } catch (
      cause
    ) {
      setError(
        errorText(
          cause,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function rejectOffer(
    offer:
      CantonRoomOffer,
  ): Promise<void> {
    if (!runtime) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const updated =
        await runtime
          .rejectOffer(
            offer,
          );

      setOffers(
        (current) =>
          mergeOffers(
            current,
            [updated],
          ),
      );
    } catch (
      cause
    ) {
      setError(
        errorText(
          cause,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const configured =
    Boolean(
      peerParty &&
      peerInstallation,
    );

  const peerLabel =
    peerInstallation
      ? shortId(
          peerInstallation,
        )
      : "private peer";

  return (
    <main className="vinss-page">
      <div className="relative z-10 mx-auto min-h-screen max-w-5xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
        <RoomHeader
          label="VINSS Secure Room"
          roomId={
            params.roomId
          }
          status={status}
        />

        <RoomTabs
          value={tab}
          onChange={setTab}
        />

        {error && (
          <div className="mb-3 rounded-xl border border-danger/35 bg-danger/[0.04] px-3 py-2.5 text-[10px] text-danger">
            {error}
          </div>
        )}

        {status ===
          "waiting_peer" &&
          creator &&
          runtime && (
            <button
              type="button"
              onClick={() => {
                setError(null);

                void runtime
                  .retryPeer()
                  .catch(
                    (cause) =>
                      setError(
                        errorText(
                          cause,
                        ),
                      ),
                  );
              }}
              className="mb-3 rounded-xl border border-signal/20 bg-signal/[0.05] px-3 py-2 text-[10px] text-signal"
            >
              Retry peer KeyPackage
            </button>
          )}

        {tab ===
        "message" ? (
          <CantonConversationPanel
            messages={
              messages
            }
            offers={
              offers
            }
            draft={draft}
            busy={busy}
            configured={
              configured
            }
            status={status}
            peerLabel={
              peerLabel
            }
            onDraftChange={
              setDraft
            }
            onSend={send}
            onCreateOffer={
              createOffer
            }
            onAcceptOffer={
              acceptOffer
            }
            onRejectOffer={
              rejectOffer
            }
          />
        ) : (
          <section className="min-h-[520px] rounded-2xl border border-wire/70 bg-vault/25 p-5">
            <p className="text-[8px] uppercase tracking-[0.17em] text-signal/55">
              {tab}
            </p>

            <h2 className="mt-2 text-[17px] font-medium text-paper/72">
              {tab ===
              "group"
                ? "Private Groups"
                : tab ===
                    "activity"
                  ? "Room Activity"
                  : "VINSS Loyalty"}
            </h2>

            <p className="mt-2 max-w-md text-[11px] leading-5 text-paper/30">
              Surface preserved from VINSS. Canton workflow wiring comes after the private chat path is verified.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

function mergeMessages(
  current:
    readonly CantonRoomMessage[],
  incoming:
    readonly CantonRoomMessage[],
):
  CantonRoomMessage[] {
  const byId =
    new Map(
      current.map(
        (message) => [
          message.id,
          message,
        ],
      ),
    );

  for (
    const message
    of incoming
  ) {
    byId.set(
      message.id,
      message,
    );
  }

  return [
    ...byId.values(),
  ].sort(
    (left, right) =>
      left.sentAt -
      right.sentAt,
  );
}

function mergeOffers(
  current:
    readonly CantonRoomOffer[],
  incoming:
    readonly CantonRoomOffer[],
):
  CantonRoomOffer[] {
  const byId =
    new Map(
      current.map(
        (offer) => [
          offer.dealId,
          offer,
        ],
      ),
    );

  for (
    const offer
    of incoming
  ) {
    const existing =
      byId.get(
        offer.dealId,
      );

    byId.set(
      offer.dealId,
      existing
        ? {
            ...existing,
            ...offer,
          }
        : offer,
    );
  }

  return [
    ...byId.values(),
  ].sort(
    (left, right) =>
      left.sentAt -
      right.sentAt,
  );
}

function applyDealActions(
  current:
    readonly CantonRoomOffer[],
  actions:
    readonly CantonRoomDealAction[],
):
  CantonRoomOffer[] {
  const latest =
    new Map(
      actions.map(
        (action) => [
          action.dealId,
          action,
        ],
      ),
    );

  return current.map(
    (offer) => {
      const action =
        latest.get(
          offer.dealId,
        );

      if (!action) {
        return offer;
      }

      if (
        action.action ===
        "accept"
      ) {
        return {
          ...offer,
          status:
            "accepted" as const,

          ...(action
            .cantonContractId
            ? {
                agreementContractId:
                  action
                    .cantonContractId,
              }
            : {}),
        };
      }

      return {
        ...offer,
        status:
          "rejected" as const,
      };
    },
  );
}

function shortId(
  value: string,
): string {
  if (
    value.length <= 18
  ) {
    return value;
  }

  return `${value.slice(
    0,
    8,
  )}…${value.slice(-6)}`;
}

function errorText(
  value: unknown,
): string {
  return value instanceof Error
    ? value.message
    : String(value);
}
