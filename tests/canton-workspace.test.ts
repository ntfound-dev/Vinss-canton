import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  makeInvite,
  encodeInvite,
  decodeInvite,
  inviteRequestId,
  findInvitePeer,
  registerInvite,
  resolveInvite,
  saveInvite,
  installationFor,
} from "../frontend/lib/canton-invite";
import {
  escrowState,
  readRooms,
  rememberRoom,
  cantonNetwork,
} from "../frontend/lib/workspace";
import {
  filterJobs,
  validJob,
  type JobListing,
} from "../frontend/lib/job-types";
import {
  startJobConversation,
  incomingJobRooms,
} from "../frontend/lib/job-conversations";
import type {
  CantonCreatedContract,
  CantonLedgerClient,
} from "../src/canton/ledger-client";
import type { CantonRoomOffer } from "../frontend/lib/canton-room-runtime";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    key: (i: number) => [...values.keys()][i] ?? null,
    get length() {
      return values.size;
    },
  });
  vi.stubGlobal("window", { dispatchEvent: () => true });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const contract = (
  requestId: string,
  requester = "Guest::party",
  recipient = "Host::party",
  offset = 1n,
): CantonCreatedContract => ({
  contractId: `request-${offset}`,
  templateId: "pkg:Vinss.Messaging:KeyPackageRequest",
  offset,
  createArgument: {
    requestId,
    requester,
    recipient,
    installationId: "11111111-1111-4111-8111-111111111111",
  },
});
function ledger(party: string, contracts: CantonCreatedContract[] = []) {
  return {
    getAuthenticatedIdentity: async () => ({
      userId: `wallet:${party}`,
      primaryParty: party,
      canActAs: [party],
      canReadAs: [party],
    }),
    queryActiveContracts: async () => contracts,
    submitCreates: vi.fn(async () => ({
      updateId: "update",
      completionOffset: 2n,
    })),
  } as unknown as CantonLedgerClient;
}
describe("private invites", () => {
  it("round-trips Unicode titles while rejecting invalid, expired and wrong-network invites", () => {
    const invite = makeInvite("Host::party", "Desain café");
    expect(decodeInvite(encodeInvite(invite))).toEqual(invite);
    expect(() => decodeInvite("garbage!")).toThrow();
    expect(() =>
      decodeInvite(encodeInvite(invite), "different-network"),
    ).toThrow(/network/);
    expect(() =>
      decodeInvite(encodeInvite(invite), invite.network, invite.expires + 1),
    ).toThrow(/expired/);
  });
  it("separates wallet installations on the same device and keeps them stable", () => {
    const a = installationFor("wallet:Alice"),
      b = installationFor("wallet:Bob");
    expect(a).not.toBe(b);
    expect(installationFor("wallet:Alice")).toBe(a);
  });
  it("resolves only matching signed requests addressed to the creator, earliest request first", async () => {
    const invite = makeInvite("Host::party"),
      id = await inviteRequestId(invite);
    const wrongRecipient = contract(id, "Other", "Elsewhere", 1n),
      later = contract(id, "Late", "Host::party", 10n),
      first = contract(id, "First", "Host::party", 2n);
    expect(
      findInvitePeer(
        [later, wrongRecipient, contract("wrong"), first],
        id,
        "Host::party",
      )?.party,
    ).toBe("First");
    expect(
      findInvitePeer(
        [{ ...first, templateId: "pkg:Other:KeyPackageRequest" }],
        id,
        "Host::party",
      ),
    ).toBeUndefined();
  });
  it("creates an authenticated Canton binding and routes the guest to the host installation", async () => {
    const invite = makeInvite("Host::party"),
      client = ledger("Guest::party");
    const room = await registerInvite(client, invite, "Guest::party");
    expect(room.peerInstallation).toBe(invite.installation);
    expect(room.creator).toBe(false);
    expect(client.submitCreates).toHaveBeenCalledWith(
      expect.objectContaining({
        actingParty: "Guest::party",
        creates: [
          expect.objectContaining({
            createArguments: expect.objectContaining({
              recipient: invite.host,
              requester: "Guest::party",
              requestId: await inviteRequestId(invite),
            }),
          }),
        ],
      }),
    );
  });
  it("does not submit when the wallet changed or a creator tries to join itself", async () => {
    const i = makeInvite("Host::party"),
      client = ledger("SomeoneElse");
    await expect(registerInvite(client, i, "Guest::party")).rejects.toThrow(
      /changed/,
    );
    expect(client.submitCreates).not.toHaveBeenCalled();
    await expect(registerInvite(ledger(i.host), i, i.host)).rejects.toThrow(
      /other participant/,
    );
  });
  it("refuses a replaced host link and only resolves invites created on this device", async () => {
    const i = makeInvite("Host::party"),
      requestId = await inviteRequestId(i),
      client = ledger(i.host, [contract(requestId)]);
    await expect(resolveInvite(client, i, i.host)).rejects.toThrow(/created/);
    saveInvite(i);
    expect((await resolveInvite(client, i, i.host))?.peerParty).toBe(
      "Guest::party",
    );
    await expect(
      resolveInvite(client, { ...i, title: "Tampered" }, i.host),
    ).rejects.toThrow(/created/);
  });
  it("is idempotent for the same requester installation", async () => {
    const i = makeInvite("Host::party"),
      installation = installationFor("wallet:Guest::party"),
      c = contract(await inviteRequestId(i));
    c.createArgument.installationId = installation;
    const client = ledger("Guest::party", [c]);
    await registerInvite(client, i, "Guest::party");
    expect(client.submitCreates).not.toHaveBeenCalled();
  });
});
describe("workspace state", () => {
  it("does not show funded escrow merely because a token administrator exists", () => {
    const offer = {
      status: "accepted",
      instrumentAdmin: "Registry",
      lifecycle: "accepted",
    } as CantonRoomOffer;
    expect(escrowState(offer).funded).toBe(false);
    expect(
      escrowState({ ...offer, escrowContractId: "actual-escrow" }).funded,
    ).toBe(true);
  });
  it("keeps bookmarks isolated by wallet and network", () => {
    const room = {
      id: "room",
      title: "Private conversation",
      peerParty: "B",
      peerInstallation: "device",
      creator: true,
      updatedAt: 1,
    };
    rememberRoom("A", room);
    expect(readRooms("B")).toEqual([]);
    expect(readRooms("A")).toHaveLength(1);
    vi.stubEnv("NEXT_PUBLIC_CANTON_NETWORK", "another");
    expect(readRooms("A")).toEqual([]);
  });
});
const job: JobListing = {
  id: "job-one",
  title: "Mobile UI",
  description: "Design a clear interface",
  category: "Design",
  budget: "350",
  asset: "USDCx",
  delivery: "7 days",
  tags: ["UI"],
  publisher: "Studio",
  ownerParty: "Host::party",
  ownerInstallation: "22222222-2222-4222-8222-222222222222",
  network: cantonNetwork(),
  createdAt: "2026-10-06T00:00:00Z",
};
describe("marketplace entry", () => {
  it("filters and paginates without rendering the entire catalogue", () => {
    const jobs = Array.from({ length: 24 }, (_, i) => ({
      ...job,
      id: `job-${i}`,
      category: i % 2 ? "Development" : "Design",
    }));
    expect(filterJobs(jobs, "mobile", "Design", 2).items).toHaveLength(3);
    expect(filterJobs(jobs, "unmatched", "All", 20).page).toBe(1);
    expect(filterJobs(jobs, "", "All", NaN).page).toBe(1);
  });
  it("rejects invalid listing prices and requires real owner routing", () => {
    expect(validJob(job)).toBe(true);
    expect(validJob({ ...job, budget: "NaN" })).toBe(false);
    expect(validJob({ ...job, ownerParty: "" })).toBe(false);
  });
  it("creates a separate signed conversation request for each applicant", async () => {
    const a = await startJobConversation(ledger("Alice"), job, "Alice"),
      b = await startJobConversation(ledger("Bob"), job, "Bob");
    expect(a.id).not.toBe(b.id);
    expect(a.creator).toBe(true);
    expect(a.jobId).toBe(job.id);
    const request = contract(
      `vinss-job:v1:${job.id}:${a.id}`,
      "Alice",
      job.ownerParty,
    );
    expect(incomingJobRooms([request], job.ownerParty)[0]?.creator).toBe(false);
    expect(incomingJobRooms([request], "Unrelated")).toEqual([]);
  });
  it("never turns sample jobs into real ledger submissions", async () => {
    const client = ledger("Alice");
    await expect(
      startJobConversation(client, { ...job, demo: true }, "Alice"),
    ).rejects.toThrow(/Sample/);
    expect(client.submitCreates).not.toHaveBeenCalled();
  });
});
