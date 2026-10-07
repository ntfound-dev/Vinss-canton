import type { CantonRoomOffer } from "./canton-room-runtime";
export const cantonNetwork = () =>
  process.env.NEXT_PUBLIC_CANTON_NETWORK?.trim().toLowerCase() || "devnet";
export const shortId = (v: string) =>
  v.length > 22 ? `${v.slice(0, 10)}…${v.slice(-6)}` : v;
export const assetName = (v: string) => (v === "Amulet" ? "CC" : v);
export interface RoomBookmark {
  id: string;
  title: string;
  peerParty: string;
  peerInstallation: string;
  creator: boolean;
  updatedAt: number;
  jobId?: string;
  bindingRequestId?: string;
  kind?: "group";
}
export function roomUrl(r: RoomBookmark) {
  const q = new URLSearchParams({
    peerParty: r.peerParty,
    peerInstallation: r.peerInstallation,
    mode: r.creator ? "creator" : "joiner",
  });
  if (r.bindingRequestId) q.set("bindingRequest", r.bindingRequestId);
  if (r.jobId) q.set("job", r.jobId);
  return `/${r.kind === "group" ? "group" : "room"}/${encodeURIComponent(r.id)}?${q}`;
}
const roomKey = (p: string) => `vinss:rooms:v1:${cantonNetwork()}:${p}`;
export function readRooms(p: string): RoomBookmark[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(roomKey(p)) || "[]");
    return Array.isArray(rows)
      ? rows.filter((r): r is RoomBookmark =>
          Boolean(
            r &&
            typeof r.id === "string" &&
            typeof r.title === "string" &&
            typeof r.peerParty === "string" &&
            typeof r.peerInstallation === "string" &&
            typeof r.creator === "boolean" &&
            typeof r.updatedAt === "number",
          ),
        )
      : [];
  } catch {
    return [];
  }
}
export function rememberRoom(p: string, r: RoomBookmark) {
  // Navigation metadata only. Never persist decrypted messages or private offer terms here.
  localStorage.setItem(
    roomKey(p),
    JSON.stringify(
      [r, ...readRooms(p).filter((x) => x.id !== r.id)].slice(0, 200),
    ),
  );
  window.dispatchEvent(new Event("vinss:rooms-changed"));
}
export function escrowState(o: CantonRoomOffer) {
  const funded = Boolean(o.escrowContractId || o.allocationContractId);
  if (o.status === "rejected")
    return { label: "Declined", step: 0, funded: false, tone: "muted" };
  if (o.lifecycle === "settled")
    return {
      label: "Settlement complete",
      step: 5,
      funded: true,
      tone: "green",
    };
  if (o.lifecycle === "approved")
    return {
      label: "Approved · ready to settle",
      step: 4,
      funded,
      tone: "green",
    };
  if (o.lifecycle === "revision_requested")
    return { label: "Revision requested", step: 3, funded, tone: "amber" };
  if (o.lifecycle === "submitted")
    return { label: "Work submitted", step: 3, funded, tone: "amber" };
  if (o.status === "accepted")
    return {
      label: funded ? "Escrow funded" : "Offer accepted",
      step: funded ? 2 : 1,
      funded,
      tone: "green",
    };
  return {
    label: "Awaiting acceptance",
    step: 0,
    funded: false,
    tone: "amber",
  };
}
