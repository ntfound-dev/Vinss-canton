import { expect, it } from "vitest";
import { CantonMessagingTransport } from "../src/messaging/canton/transport";
import type { CantonLedgerClient } from "../src/canton/ledger-client";
import type { CantonMessagingDirectory } from "../src/messaging/canton/directory";
it("ignores a KeyPackage advertised by another Party using the peer installation ID", async () => {
  const offer = (owner: string, bytes: string, days: number) => ({
    contractId: owner,
    templateId: "pkg:Vinss.Messaging:KeyPackageOffer",
    offset: 1n,
    createArgument: {
      owner,
      requester: "Alice",
      installationId: "bob-phone",
      keyPackageB64: bytes,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
    },
  });
  const ledger = {
    queryActiveContracts: async () => [
      offer("Mallory", "CQk=", 3),
      offer("Bob", "AQI=", 1),
    ],
  } as unknown as CantonLedgerClient;
  const directory = {
    activeParty: () => "Alice",
    partyForInstallation: async () => "Bob",
  } as CantonMessagingDirectory;
  const result = await new CantonMessagingTransport(
    ledger,
    directory,
  ).fetchKeyPackages(["bob-phone"]);
  expect(result).toHaveLength(1);
  expect(Array.from(result[0]!.keyPackage)).toEqual([1, 2]);
});
