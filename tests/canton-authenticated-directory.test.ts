import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  CantonCreatedContract,
  CantonLedgerClient,
} from "../src/canton/ledger-client.js";

import {
  AuthenticatedCantonMessagingDirectory,
} from "../src/messaging/canton/authenticated-directory.js";

function fakeLedger(
  canActAs:
    readonly string[],

  contracts:
    readonly CantonCreatedContract[] =
      [],
): CantonLedgerClient {
  return {
    async getAuthenticatedIdentity() {
      return {
        userId:
          "alice-user",

        primaryParty:
          "Alice::party",

        canActAs,

        canReadAs: [],
      };
    },

    async submitCreates() {
      throw new Error(
        "unused",
      );
    },

    async queryActiveContracts() {
      return contracts;
    },

    async queryActiveContractsSnapshot() {
      return {
        offset:
          contracts.at(-1)
            ?.offset ??
          0n,

        contracts,
      };
    },

    async queryCreatedContractsSince() {
      return [];
    },
  };
}

describe(
  "Authenticated Canton messaging directory",
  () => {
    it(
      "binds the local installation to authenticated primary party",
      async () => {
        const directory =
          await AuthenticatedCantonMessagingDirectory
            .connect(
              fakeLedger(
                [
                  "Alice::party",
                ],

                [
                  {
                    contractId:
                      "bob-key-package",

                    templateId:
                      "abc:Vinss.Messaging:KeyPackageOffer",

                    offset:
                      10n,

                    createArgument: {
                      packageId:
                        "kp-1",

                      requestId:
                        "request-1",

                      owner:
                        "Bob::party",

                      requester:
                        "Alice::party",

                      installationId:
                        "bob-phone",

                      keyPackageB64:
                        "AQI=",

                      createdAt:
                        new Date()
                          .toISOString(),

                      expiresAt:
                        new Date(
                          Date.now() +
                            60_000,
                        ).toISOString(),
                    },
                  },
                ],
              ),
              {
                localInstallationId:
                  "alice-phone",

                async resolvePartyForInstallation(
                  installationId,
                ) {
                  if (
                    installationId ===
                    "bob-phone"
                  ) {
                    return "Bob::party";
                  }

                  throw new Error(
                    "unknown installation",
                  );
                },

                async recipientsForConversation() {
                  return [
                    "Bob::party",
                  ];
                },

                async keyPackageReaders() {
                  return [
                    "Bob::party",
                  ];
                },
              },
            );

        expect(
          directory.activeParty(),
        ).toBe(
          "Alice::party",
        );

        await expect(
          directory.partyForInstallation(
            "alice-phone",
          ),
        ).resolves.toBe(
          "Alice::party",
        );

        await expect(
          directory.partyForInstallation(
            "bob-phone",
          ),
        ).resolves.toBe(
          "Bob::party",
        );
      },
    );

    it(
      "rejects a remote installation without a Canton-verified binding",
      async () => {
        const directory =
          await AuthenticatedCantonMessagingDirectory
            .connect(
              fakeLedger([
                "Alice::party",
              ]),
              {
                localInstallationId:
                  "alice-phone",

                async resolvePartyForInstallation() {
                  return "Bob::party";
                },

                async recipientsForConversation() {
                  return [
                    "Bob::party",
                  ];
                },

                async keyPackageReaders() {
                  return [
                    "Bob::party",
                  ];
                },
              },
            );

        await expect(
          directory
            .partyForInstallation(
              "bob-phone",
            ),
        ).rejects.toThrow(
          "No verified Canton party binding",
        );
      },
    );

    it(
      "rejects a user without CanActAs for its primary party",
      async () => {
        await expect(
          AuthenticatedCantonMessagingDirectory
            .connect(
              fakeLedger([]),
              {
                localInstallationId:
                  "alice-phone",

                async resolvePartyForInstallation() {
                  return "Bob::party";
                },

                async recipientsForConversation() {
                  return [];
                },

                async keyPackageReaders() {
                  return [];
                },
              },
            ),
        ).rejects.toThrow(
          "cannot act as primary party",
        );
      },
    );
  },
);
