import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  CantonCreatedContract,
  CantonLedgerClient,
  CantonSubmissionResult,
  CantonSubmitCreates,
} from "../src/canton/ledger-client.js";

import {
  CantonMessagingTransport,
} from "../src/messaging/canton/transport.js";

import type {
  CantonMessagingDirectory,
} from "../src/messaging/canton/directory.js";

class FakeLedger
  implements CantonLedgerClient
{
  readonly submissions:
    CantonSubmitCreates[] =
      [];

  contracts:
    CantonCreatedContract[] =
      [];

  async submitCreates(
    input:
      CantonSubmitCreates,
  ): Promise<CantonSubmissionResult> {
    this.submissions.push(
      input,
    );

    return {
      updateId:
        "update-1",
      completionOffset:
        10n,
    };
  }

  async queryActiveContracts():
    Promise<
      readonly CantonCreatedContract[]
    > {
    return this.contracts;
  }
}

const directory:
  CantonMessagingDirectory = {
    activeParty() {
      return "Alice::party";
    },

    async partyForInstallation(
      installationId,
    ) {
      if (
        installationId ===
        "alice-phone"
      ) {
        return "Alice::party";
      }

      if (
        installationId ===
        "bob-phone"
      ) {
        return "Bob::party";
      }

      return "Charlie::party";
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
  };

describe(
  "Canton messaging transport",
  () => {
    it(
      "submits an MLS handshake batch atomically",
      async () => {
        const ledger =
          new FakeLedger();

        const transport =
          new CantonMessagingTransport(
            ledger,
            directory,
          );

        await transport
          .publishHandshakes([
            {
              conversationId:
                "deal-1",
              kind: "welcome",
              senderInstallationId:
                "alice-phone",
              recipientInstallationId:
                "bob-phone",
              sentAt: 100,
              payload:
                new Uint8Array(
                  [1, 2],
                ),
            },
            {
              conversationId:
                "deal-1",
              kind: "commit",
              senderInstallationId:
                "alice-phone",
              recipientInstallationId:
                "charlie-phone",
              sentAt: 100,
              payload:
                new Uint8Array(
                  [3, 4],
                ),
            },
          ]);

        expect(
          ledger.submissions,
        ).toHaveLength(1);

        expect(
          ledger.submissions[0]
            ?.creates,
        ).toHaveLength(2);
      },
    );

    it(
      "writes MLS ciphertext instead of plaintext",
      async () => {
        const ledger =
          new FakeLedger();

        const transport =
          new CantonMessagingTransport(
            ledger,
            directory,
          );

        await transport
          .publishCiphertext({
            id: "message-1",
            conversationId:
              "deal-1",
            senderInstallationId:
              "alice-phone",
            epoch: 7n,
            sentAt: 100,
            payload:
              new Uint8Array(
                [9, 8, 7],
              ),
          });

        const args =
          ledger.submissions[0]
            ?.creates[0]
            ?.createArguments;

        expect(args).toBeDefined();

        expect(
          args?.epoch,
        ).toBe("7");

        expect(
          args?.ciphertextB64,
        ).toBeTruthy();

        expect(
          JSON.stringify(args),
        ).not.toContain(
          "hello",
        );
      },
    );

    it(
      "uses Canton event offsets as MLS delivery sequence",
      async () => {
        const ledger =
          new FakeLedger();

        ledger.contracts = [
          {
            contractId:
              "contract-1",
            templateId:
              "abc:Vinss.Messaging:MlsDelivery",
            offset: 42n,
            createArgument: {
              deliveryId:
                "delivery-1",
              channelId:
                "deal-1",
              sender:
                "Alice::party",
              recipient:
                "Bob::party",
              senderInstallationId:
                "alice-phone",
              recipientInstallationId:
                "bob-phone",
              kind: "welcome",
              payloadB64:
                "AQI=",
              createdAt:
                "2026-09-23T00:00:00.000Z",
            },
          },
        ];

        const bobDirectory:
          CantonMessagingDirectory = {
            ...directory,

            activeParty() {
              return "Bob::party";
            },
          };

        const transport =
          new CantonMessagingTransport(
            ledger,
            bobDirectory,
          );

        const result =
          await transport
            .fetchHandshakes(
              "bob-phone",
            );

        expect(
          result.items[0]
            ?.sequence,
        ).toBe(42n);

        expect(
          result.nextCursor,
        ).toBe("h:42");
      },
    );
  },
);
