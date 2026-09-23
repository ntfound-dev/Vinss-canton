"use client";

import Link from "next/link";
import {
  useParams,
  useSearchParams,
} from "next/navigation";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  CantonRoomRuntime,
  type CantonRoomMessage,
  type CantonRoomStatus,
} from "@/lib/canton-room-runtime";

type RoomTab =
  | "message"
  | "group"
  | "activity"
  | "loyalty";

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
            if (disposed) {
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

          onError(
            cause,
          ) {
            if (!disposed) {
              setError(
                cause.message,
              );
            }
          },
        })
        .then(
          (connected) => {
            if (disposed) {
              connected
                .close();

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
            if (!disposed) {
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

  async function send(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

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

  const items = [
    {
      key:
        "message" as const,
      label:
        "Message",
    },
    {
      key:
        "group" as const,
      label:
        "Group",
    },
    {
      key:
        "activity" as const,
      label:
        "Activity",
    },
    {
      key:
        "loyalty" as const,
      label:
        "Loyalty",
    },
  ];

  const configured =
    Boolean(
      peerParty &&
      peerInstallation,
    );

  return (
    <main className="vinss-page">
      <div className="relative z-10 mx-auto min-h-screen max-w-5xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-4 flex items-center gap-2.5">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-vault/55 text-paper/55 ring-1 ring-wire/60"
          >
            ←
          </Link>

          <div className="min-w-0 flex-1">
            <p className="text-[8px] uppercase tracking-[0.17em] text-signal/55">
              Private Deal Room
            </p>

            <h1 className="truncate text-[18px] font-medium text-paper">
              VINSS Secure Room
            </h1>

            <p className="truncate font-mono text-[8px] text-paper/20">
              {params.roomId}
            </p>
          </div>

          <div className="flex items-center gap-2 border border-signal/15 bg-signal/[0.04] px-3 py-2 text-[9px] uppercase text-signal/70">
            <span className="vinss-live-dot" />
            {status === "ready"
              ? "Encrypted"
              : status ===
                  "waiting_peer"
                ? "Waiting"
                : status ===
                    "connecting"
                  ? "Connecting"
                  : "Offline"}
          </div>
        </header>

        <nav className="mb-3 rounded-2xl bg-vault/35 p-1 ring-1 ring-wire/65">
          <div className="flex gap-1 overflow-x-auto sm:grid sm:grid-cols-4">
            {items.map(
              (item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    setTab(
                      item.key,
                    )
                  }
                  className={
                    tab === item.key
                      ? "min-w-[108px] flex-1 rounded-xl bg-signal/[0.09] px-3 py-2.5 text-[11px] text-signal ring-1 ring-signal/15 sm:min-w-0"
                      : "min-w-[108px] flex-1 rounded-xl px-3 py-2.5 text-[11px] text-paper/38 sm:min-w-0"
                  }
                >
                  {item.label}
                </button>
              ),
            )}
          </div>
        </nav>

        {!configured && (
          <div className="mb-3 border border-wire/50 bg-vault/25 px-4 py-3 text-[11px] leading-5 text-paper/40">
            Room shell ready. Secure peer parameters are not present yet.
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
              className="mb-3 border border-signal/20 bg-signal/[0.05] px-3 py-2 text-[10px] text-signal"
            >
              Retry peer KeyPackage
            </button>
          )}

        {error && (
          <div className="mb-3 border border-danger/35 bg-danger/[0.04] px-3 py-2 text-[10px] text-danger">
            {error}
          </div>
        )}

        {tab === "message" && (
          <section className="vinss-panel flex min-h-[66vh] flex-col">
            <div className="border-b border-wire/45 px-4 py-3">
              <p className="text-[9px] uppercase tracking-[0.16em] text-paper/30">
                OpenMLS private conversation
              </p>
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              {messages.length ===
                0 && (
                <div className="m-auto text-center">
                  <p className="text-sm text-paper/55">
                    No encrypted messages yet
                  </p>

                  <p className="mt-2 text-[11px] text-paper/28">
                    Messages here travel as MLS ciphertext through Canton.
                  </p>
                </div>
              )}

              {messages.map(
                (message) => (
                  <div
                    key={
                      message.id
                    }
                    className={
                      message.own
                        ? "ml-auto max-w-[82%] border border-signal/20 bg-signal/[0.07] px-3 py-2.5"
                        : "mr-auto max-w-[82%] border border-wire/55 bg-vault/60 px-3 py-2.5"
                    }
                  >
                    <p className="text-xs leading-5 text-paper/85">
                      {
                        message.text
                      }
                    </p>

                    <p className="mt-1 text-[8px] text-paper/25">
                      {new Date(
                        message.sentAt,
                      ).toLocaleTimeString()}
                    </p>
                  </div>
                ),
              )}
            </div>

            <form
              onSubmit={send}
              className="border-t border-wire/45 p-3"
            >
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(
                    event,
                  ) =>
                    setDraft(
                      event.target
                        .value,
                    )
                  }
                  rows={1}
                  disabled={
                    status !==
                      "ready" ||
                    busy
                  }
                  placeholder={
                    status ===
                    "ready"
                      ? "Encrypted message…"
                      : "Secure session connecting…"
                  }
                  className="min-h-11 flex-1 resize-none border border-wire/55 bg-black/20 px-3 py-3 text-xs text-paper outline-none placeholder:text-paper/20 disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={
                    status !==
                      "ready" ||
                    busy ||
                    !draft.trim()
                  }
                  className="h-11 border border-signal/20 bg-signal/[0.06] px-4 text-xs font-medium text-signal disabled:opacity-35"
                >
                  {busy
                    ? "Sending…"
                    : "Send"}
                </button>
              </div>
            </form>
          </section>
        )}

        {tab !== "message" && (
          <section className="vinss-panel min-h-[66vh] p-6">
            <p className="text-[9px] uppercase tracking-[0.16em] text-signal/55">
              {tab}
            </p>

            <p className="mt-3 text-xs text-paper/35">
              Preserved VINSS product surface. Wiring follows after private chat.
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

function errorText(
  value: unknown,
): string {
  return value instanceof Error
    ? value.message
    : String(value);
}
