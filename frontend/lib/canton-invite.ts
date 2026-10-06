import type {
  CantonLedgerClient,
  CantonCreatedContract,
} from "../../src/canton/ledger-client";
import { isCantonTemplate } from "../../src/messaging/canton/templates";
import { cantonNetwork, type RoomBookmark } from "./workspace";

export interface PrivateInvite {
  v: 1;
  id: string;
  secret: string;
  host: string;
  installation: string;
  network: string;
  expires: number;
  title: string;
}
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
export const REQUEST_TEMPLATE =
  "#vinss-canton-messaging:Vinss.Messaging:KeyPackageRequest";
export function installationFor(userId: string): string {
  const key = `vinss:installation:${userId}`;
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  // Preserve installations already shared by the old advanced entry form.
  const preview = localStorage.getItem("vinss:installation:local-preview");
  let previewClaimed = false;
  for (let i = 0; i < localStorage.length; i++) {
    const other = localStorage.key(i);
    if (
      other?.startsWith("vinss:installation:wallet:") &&
      other !== key &&
      localStorage.getItem(other) === preview
    )
      previewClaimed = true;
  }
  const id = preview && !previewClaimed ? preview : crypto.randomUUID();
  localStorage.setItem(key, id);
  localStorage.setItem("vinss:installation:local-preview", id);
  return id;
}
export function makeInvite(
  host: string,
  title = "Private conversation",
): PrivateInvite {
  return {
    v: 1,
    id: crypto.randomUUID(),
    secret: crypto.randomUUID(),
    host,
    installation: installationFor(`wallet:${host}`),
    network: cantonNetwork(),
    expires: Date.now() + 24 * 60 * 60 * 1000,
    title: title.trim().slice(0, 80) || "Private conversation",
  };
}
export function encodeInvite(invite: PrivateInvite): string {
  return btoa(
    String.fromCharCode(...new TextEncoder().encode(JSON.stringify(invite))),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function decodeInvite(
  token: string,
  network = cantonNetwork(),
  now = Date.now(),
): PrivateInvite {
  if (token.length > 6000 || !/^[\w-]+$/.test(token))
    throw new Error("This invite link is not valid.");
  let value: PrivateInvite;
  try {
    value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(
          atob(token.replace(/-/g, "+").replace(/_/g, "/")),
          (x) => x.charCodeAt(0),
        ),
      ),
    ) as PrivateInvite;
  } catch {
    throw new Error("This invite link is not valid.");
  }
  if (
    value.v !== 1 ||
    !UUID.test(value.id) ||
    !UUID.test(value.secret) ||
    !UUID.test(value.installation) ||
    typeof value.host !== "string" ||
    !value.host.trim() ||
    value.host.length > 512 ||
    typeof value.title !== "string" ||
    value.title.length > 80 ||
    !Number.isFinite(value.expires)
  )
    throw new Error("This invite link is not valid.");
  if (value.network !== network)
    throw new Error(
      `This invite belongs to ${value.network}, not this Canton network.`,
    );
  if (value.expires <= now)
    throw new Error("This invite has expired. Ask the sender for a new link.");
  if (value.expires > now + 25 * 60 * 60 * 1000)
    throw new Error("Invalid invite expiry.");
  return value;
}
export async function inviteRequestId(invite: PrivateInvite): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${invite.id}:${invite.secret}`),
  );
  return `vinss-invite:v1:${Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, "0")).join("")}`;
}
export function findInvitePeer(
  contracts: readonly CantonCreatedContract[],
  requestId: string,
  host: string,
) {
  // The request's requester is a Canton signatory, not an identity supplied by an HTTP response.
  const matches = contracts.filter(
    (c) =>
      isCantonTemplate(c.templateId, "KeyPackageRequest") &&
      c.createArgument.requestId === requestId &&
      c.createArgument.recipient === host &&
      typeof c.createArgument.requester === "string" &&
      c.createArgument.requester !== host &&
      typeof c.createArgument.installationId === "string" &&
      UUID.test(c.createArgument.installationId),
  );
  matches.sort((a, b) =>
    a.offset < b.offset
      ? -1
      : a.offset > b.offset
        ? 1
        : a.contractId.localeCompare(b.contractId),
  );
  const first = matches[0];
  return first
    ? {
        party: first.createArgument.requester as string,
        installation: first.createArgument.installationId as string,
      }
    : undefined;
}
export async function registerInvite(
  ledger: CantonLedgerClient,
  invite: PrivateInvite,
  party: string,
): Promise<RoomBookmark> {
  decodeInvite(encodeInvite(invite));
  if (party === invite.host)
    throw new Error("Open this invite with the other participant’s wallet.");
  const identity = await ledger.getAuthenticatedIdentity();
  if (identity.primaryParty !== party)
    throw new Error("The active wallet changed. Please retry.");
  const installation = installationFor(identity.userId),
    requestId = await inviteRequestId(invite);
  const contracts = await ledger.queryActiveContracts(party);
  const existing = findInvitePeer(contracts, requestId, invite.host);
  if (
    existing &&
    (existing.party !== party || existing.installation !== installation)
  )
    throw new Error(
      "This invitation is already bound to another installation.",
    );
  if (!existing)
    await ledger.submitCreates({
      actingParty: party,
      commandId: `join-${invite.id}-${installation}`,
      creates: [
        {
          templateId: REQUEST_TEMPLATE,
          createArguments: {
            requestId,
            requester: party,
            recipient: invite.host,
            installationId: installation,
          },
        },
      ],
    });
  return {
    id: invite.id,
    title: invite.title,
    peerParty: invite.host,
    peerInstallation: invite.installation,
    creator: false,
    updatedAt: Date.now(),
  };
}
export async function resolveInvite(
  ledger: CantonLedgerClient,
  invite: PrivateInvite,
  party: string,
): Promise<RoomBookmark | undefined> {
  decodeInvite(encodeInvite(invite));
  if (party !== invite.host)
    throw new Error("Only the invite creator can resolve this room.");
  if (
    localStorage.getItem(
      `vinss:invite:v1:${invite.network}:${party}:${invite.id}`,
    ) !== encodeInvite(invite)
  )
    throw new Error("Open this invite in the browser where you created it.");
  const peer = findInvitePeer(
    await ledger.queryActiveContracts(party),
    await inviteRequestId(invite),
    party,
  );
  return peer
    ? {
        id: invite.id,
        title: invite.title,
        peerParty: peer.party,
        peerInstallation: peer.installation,
        creator: true,
        updatedAt: Date.now(),
      }
    : undefined;
}
export function saveInvite(invite: PrivateInvite) {
  localStorage.setItem(
    `vinss:invite:v1:${invite.network}:${invite.host}:${invite.id}`,
    encodeInvite(invite),
  );
}
export function ownInvites(party: string): PrivateInvite[] {
  const prefix = `vinss:invite:v1:${cantonNetwork()}:${party}:`,
    items: PrivateInvite[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      try {
        items.push(decodeInvite(localStorage.getItem(key) || ""));
      } catch {
        /* Expired invites are not shown. */
      }
    }
  }
  return items.sort((a, b) => b.expires - a.expires);
}
