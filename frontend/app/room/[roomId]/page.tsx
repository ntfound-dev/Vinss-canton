"use client";

import { useParams, useSearchParams } from "next/navigation";

import { useEffect, useState } from "react";

import {
  CantonRoomRuntime,
  type CantonRoomDealAction,
  type CantonRoomMessage,
  type CantonRoomOffer,
  type CantonRoomOfferInput,
  type CantonRoomStatus,
} from "@/lib/canton-room-runtime";

import { RoomHeader } from "@/components/room/RoomHeader";

import { RoomTabs, type RoomTab } from "@/components/room/RoomTabs";

import { CantonConversationPanel } from "@/components/room/CantonConversationPanel";

import Link from "next/link";
import { useWallet } from "@/components/workspace/WalletProvider";
import { OfferCard } from "@/components/room/offer/OfferCard";
import { Icon } from "@/components/workspace/Icon";
import { readRooms, rememberRoom, escrowState } from "@/lib/workspace";
import { useJobOfferDraft } from "@/components/workspace/JobOfferDraft";

export default function RoomPage() {
  const params = useParams<{
    roomId: string;
  }>();

  const search = useSearchParams();

  const peerParty = search.get("peerParty");

  const peerInstallation = search.get("peerInstallation");

  const creator = search.get("mode") === "creator";

  const [tab, setTab] = useState<RoomTab>("message");

  const [draft, setDraft] = useState("");

  const [runtime, setRuntime] = useState<CantonRoomRuntime | null>(null);

  const { session } = useWallet();
  const walletParty = session?.partyId ?? null;
  const [roomTitle, setRoomTitle] = useState("Private conversation");
  const initialOfferValues = useJobOfferDraft(search.get("job"));

  const [status, setStatus] = useState<CantonRoomStatus | "idle">("idle");

  const [messages, setMessages] = useState<CantonRoomMessage[]>([]);

  const [offers, setOffers] = useState<CantonRoomOffer[]>([]);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages([]);
    setOffers([]);
    setError(null);
    if (!peerParty || !peerInstallation || !walletParty) {
      setRuntime(null);
      setStatus("idle");
      return;
    }

    let disposed = false;

    let active: CantonRoomRuntime | undefined;

    void CantonRoomRuntime.connect({
      conversationId: params.roomId,

      walletParty,

      peerParty,

      peerInstallationId: peerInstallation,

      creator,
      ...(search.get("bindingRequest")
        ? { bindingRequestId: search.get("bindingRequest")! }
        : {}),

      onStatus(status) {
        if (!disposed) setStatus(status);
      },

      onMessages(incoming) {
        if (disposed) {
          return;
        }

        setMessages((current) => mergeMessages(current, incoming));
      },

      onOffers(incoming) {
        if (disposed) {
          return;
        }

        setOffers((current) => mergeOffers(current, incoming));
      },

      onDealActions(actions) {
        if (disposed) {
          return;
        }

        setOffers((current) => applyDealActions(current, actions));
      },

      onError(cause) {
        if (!disposed) {
          setError(cause.message);
        }
      },
    })
      .then((connected) => {
        if (disposed) {
          connected.close();
          return;
        }

        active = connected;

        setRuntime(connected);
      })
      .catch((cause: unknown) => {
        if (!disposed) {
          setError(errorText(cause));
        }
      });

    return () => {
      disposed = true;

      active?.close();
    };
  }, [creator, params.roomId, peerInstallation, peerParty, walletParty]);

  useEffect(() => {
    if (!walletParty || !peerParty || !peerInstallation) return;
    const previous = readRooms(walletParty).find((r) => r.id === params.roomId);
    const title = previous?.title || "Private conversation";
    setRoomTitle(title);
    rememberRoom(walletParty, {
      id: params.roomId,
      title,
      peerParty,
      peerInstallation,
      creator,
      updatedAt: Date.now(),
      ...(search.get("job") ? { jobId: search.get("job")! } : {}),
    });
  }, [walletParty, params.roomId, peerParty, peerInstallation, creator]);

  useEffect(() => {
    if (!runtime || !creator || status !== "waiting_peer") return;
    let pending = false,
      stopped = false;
    const timer = setInterval(() => {
      if (pending) return;
      pending = true;
      void runtime
        .retryPeer()
        .catch((cause) => {
          if (!stopped) setError(errorText(cause));
        })
        .finally(() => {
          pending = false;
        });
    }, 5000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [runtime, creator, status]);

  async function send() {
    if (!runtime || status !== "ready" || !draft.trim()) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const message = await runtime.sendText(draft);

      setMessages((current) => mergeMessages(current, [message]));

      setDraft("");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function createOffer(input: CantonRoomOfferInput): Promise<boolean> {
    if (!runtime || status !== "ready") {
      return false;
    }

    setBusy(true);
    setError(null);

    try {
      const offer = await runtime.createOffer(input);

      setOffers((current) => mergeOffers(current, [offer]));

      return true;
    } catch (cause) {
      setError(errorText(cause));

      return false;
    } finally {
      setBusy(false);
    }
  }

  async function acceptOffer(offer: CantonRoomOffer): Promise<void> {
    if (!runtime) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const updated = await runtime.acceptOffer(offer);

      setOffers((current) => mergeOffers(current, [updated]));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function rejectOffer(offer: CantonRoomOffer): Promise<void> {
    if (!runtime) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const updated = await runtime.rejectOffer(offer);

      setOffers((current) => mergeOffers(current, [updated]));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function updateOffer(
    action: () => Promise<CantonRoomOffer>,
  ): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      const updated = await action();

      setOffers((current) => mergeOffers(current, [updated]));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function submitFulfillment(offer: CantonRoomOffer, proof: string) {
    if (!runtime) {
      return;
    }

    await updateOffer(() => runtime.submitFulfillment(offer, proof));
  }

  async function requestRevision(offer: CantonRoomOffer, note: string) {
    if (!runtime) {
      return;
    }

    await updateOffer(() => runtime.requestRevision(offer, note));
  }

  async function submitRevision(offer: CantonRoomOffer, proof: string) {
    if (!runtime) {
      return;
    }

    await updateOffer(() => runtime.submitRevision(offer, proof));
  }

  async function approveFulfillment(offer: CantonRoomOffer) {
    if (!runtime) {
      return;
    }

    await updateOffer(() => runtime.approveFulfillment(offer));
  }

  async function settleOffer(offer: CantonRoomOffer) {
    if (!runtime) {
      return;
    }

    await updateOffer(() => runtime.settleOffer(offer));
  }

  const configured = Boolean(peerParty && peerInstallation && walletParty);

  const peerLabel = peerInstallation
    ? shortId(peerInstallation)
    : "private peer";

  const actions = {
    onAccept: acceptOffer,
    onReject: rejectOffer,
    onSubmitFulfillment: submitFulfillment,
    onRequestRevision: requestRevision,
    onSubmitRevision: submitRevision,
    onApproveFulfillment: approveFulfillment,
    onSettle: settleOffer,
  };
  return (
    <>
      <RoomHeader label={roomTitle} roomId={params.roomId} status={status} />
      {!walletParty && (
        <div className="ui-alert info" style={{ marginBottom: 20 }}>
          Connect your Canton wallet using the button at the top to open this
          room.
        </div>
      )}
      {!peerParty || !peerInstallation ? (
        <div className="empty-state surface">
          <Icon name="link" />
          <h2>Open your private invite</h2>
          <p>This room needs the connection included in your invite.</p>
          <Link className="ui-button primary" href="/invite/new">
            Create an invite
          </Link>
          <Link className="text-link" href="/rooms">
            Back to conversations
          </Link>
        </div>
      ) : (
        <>
          <RoomTabs value={tab} onChange={setTab} />
          {error && (
            <div
              className="ui-alert error"
              role="alert"
              style={{ marginBottom: 18 }}
            >
              {error}
            </div>
          )}
          {status === "waiting_peer" && (
            <div
              className="ui-alert info"
              role="status"
              style={{ marginBottom: 18 }}
            >
              Waiting for the other participant to open the room. Your
              connection will update automatically.
            </div>
          )}
          <div
            id="room-tab-panel"
            role="tabpanel"
            aria-labelledby={"tab-" + tab}
          >
            {tab === "message" ? (
              <CantonConversationPanel
                messages={messages}
                offers={offers}
                draft={draft}
                busy={busy}
                configured={configured}
                status={status}
                peerLabel={peerLabel}
                initialOfferValues={initialOfferValues}
                onEscrow={() => setTab("escrow")}
                onDraftChange={setDraft}
                onSend={send}
                onCreateOffer={createOffer}
                onAcceptOffer={acceptOffer}
                onRejectOffer={rejectOffer}
                onSubmitFulfillment={submitFulfillment}
                onRequestRevision={requestRevision}
                onSubmitRevision={submitRevision}
                onApproveFulfillment={approveFulfillment}
                onSettleOffer={settleOffer}
              />
            ) : tab === "escrow" ? (
              <>
                <div className="section-heading">
                  <div>
                    <h2>Escrow & agreements</h2>
                    <p className="small muted">
                      Review terms, delivery and settlement for this
                      conversation.
                    </p>
                  </div>
                </div>
                {offers.length ? (
                  <div className="escrow-board">
                    {offers.map((offer) => (
                      <OfferCard
                        key={offer.dealId}
                        offer={offer}
                        busy={busy || status !== "ready"}
                        {...actions}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state surface">
                    <Icon name="shield" />
                    <h3>Every escrow starts with an offer.</h3>
                    <p>
                      Agree on terms in your conversation. Funding and
                      settlement are approved through your Canton wallet.
                    </p>
                    <button
                      className="ui-button"
                      onClick={() => setTab("message")}
                    >
                      Back to conversation
                    </button>
                  </div>
                )}
              </>
            ) : (
              <section className="surface padded">
                <h2>Deal status</h2>
                <p className="small muted">
                  Latest state received for each agreement.
                </p>
                {offers.length ? (
                  offers.map((o) => (
                    <div className="activity-row" key={o.dealId}>
                      <Icon name="shield" />
                      <div>
                        <h3>{escrowState(o).label}</h3>
                        <p>{o.terms}</p>
                        <details className="advanced">
                          <summary>Contract reference</summary>
                          <p className="mono break-word">
                            {o.settlementReceiptContractId ||
                              o.approvalContractId ||
                              o.fulfillmentContractId ||
                              o.escrowContractId ||
                              o.agreementContractId ||
                              o.contractId}
                          </p>
                        </details>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <p>No deal activity yet.</p>
                  </div>
                )}
              </section>
            )}
          </div>
          <details className="advanced">
            <summary>Advanced / connection details</summary>
            <div className="advanced-content small muted break-word">
              <p>Room: {params.roomId}</p>
              <p>Peer Party: {peerParty}</p>
              <p>Peer Installation: {peerInstallation}</p>
              <p>Role: {creator ? "Creator" : "Joiner"}</p>
            </div>
          </details>
        </>
      )}
    </>
  );
}

function mergeMessages(
  current: readonly CantonRoomMessage[],
  incoming: readonly CantonRoomMessage[],
): CantonRoomMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));

  for (const message of incoming) {
    byId.set(message.id, message);
  }

  return [...byId.values()].sort((left, right) => left.sentAt - right.sentAt);
}

function mergeOffers(
  current: readonly CantonRoomOffer[],
  incoming: readonly CantonRoomOffer[],
): CantonRoomOffer[] {
  const byId = new Map(current.map((offer) => [offer.dealId, offer]));

  for (const offer of incoming) {
    const existing = byId.get(offer.dealId);

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

  return [...byId.values()].sort((left, right) => left.sentAt - right.sentAt);
}

function applyDealActions(
  current: readonly CantonRoomOffer[],
  actions: readonly CantonRoomDealAction[],
): CantonRoomOffer[] {
  const latest = new Map(actions.map((action) => [action.dealId, action]));

  return current.map((offer) => {
    const action = latest.get(offer.dealId);

    if (!action) {
      return offer;
    }

    const cid = action.cantonContractId;

    switch (action.action) {
      case "accept":
        return {
          ...offer,
          status: "accepted",
          lifecycle: "accepted",
          ...(cid
            ? {
                agreementContractId: cid,
              }
            : {}),
        };

      case "reject":
        return {
          ...offer,
          status: "rejected",
        };

      case "submit_fulfillment":
      case "submit_revision":
        return {
          ...offer,
          status: "accepted",
          lifecycle: "submitted",
          ...(cid
            ? {
                fulfillmentContractId: cid,
              }
            : {}),
        };

      case "request_revision":
        return {
          ...offer,
          status: "accepted",
          lifecycle: "revision_requested",
          ...(cid
            ? {
                revisionRequestContractId: cid,
              }
            : {}),
        };

      case "approve_fulfillment":
        return {
          ...offer,
          status: "accepted",
          lifecycle: "approved",
          ...(cid
            ? {
                approvalContractId: cid,
              }
            : {}),
        };

      case "settled":
        return {
          ...offer,
          status: "accepted",
          lifecycle: "settled",
          ...(cid
            ? {
                settlementReceiptContractId: cid,
              }
            : {}),
        };

      default:
        return offer;
    }
  });
}

function shortId(value: string): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function errorText(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}
