import { it, expect } from "vitest";
import { CantonMessagingTransport } from "../src/messaging/canton/transport.js";
import type {
  CantonLedgerClient,
  CantonCreatedContract,
} from "../src/canton/ledger-client.js";
import type { CantonMessagingDirectory } from "../src/messaging/canton/directory.js";
it("requires a KeyPackage newer than signed registration and verifies signed event sender", async () => {
  const offer = (offset: bigint): CantonCreatedContract => ({
    contractId: String(offset),
    offset,
    templateId: "pkg:Vinss.Messaging:KeyPackageOffer",
    createArgument: {
      requester: "Alice",
      owner: "Bob",
      installationId: "bob",
      keyPackageB64: Buffer.from([Number(offset)]).toString("base64"),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
  });
  const ledger = {
    queryActiveContracts: async () => [offer(4n), offer(8n)],
  } as unknown as CantonLedgerClient;
  const directory = {
    activeParty: () => "Alice",
    partyForInstallation: async () => "Bob",
  } as unknown as CantonMessagingDirectory;
  const transport = new CantonMessagingTransport(
    ledger,
    directory,
    async () => "Bob",
    async () => 6n,
  );
  expect((await transport.fetchKeyPackages(["bob"]))[0]?.keyPackage).toEqual(
    new Uint8Array([8]),
  );
  const event = {
    id: "e",
    conversationId: "r",
    senderInstallationId: "bob",
    senderParty: "Mallory",
    sequence: 9n,
    epoch: 1n,
    sentAt: 1,
    payload: new Uint8Array(),
  };
  await expect(transport.verifyConversationEvent(event)).rejects.toThrow(
    /binding mismatch/,
  );
  await expect(
    transport.verifyConversationEvent({ ...event, senderParty: "Bob" }),
  ).resolves.toBeUndefined();
});
