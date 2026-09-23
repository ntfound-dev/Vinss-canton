import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  CantonLedgerClient,
} from "../src/canton/ledger-client.js";

import {
  AuthenticatedCantonMessagingDirectory,
} from "../src/messaging/canton/authenticated-directory.js";

function fakeLedger(
  canActAs:
    readonly string[],
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
      return [];
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
              fakeLedger([
                "Alice::party",
              ]),
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
