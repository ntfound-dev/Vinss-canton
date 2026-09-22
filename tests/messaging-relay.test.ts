import {
  describe,
  expect,
  it,
} from "vitest";

import {
  MemoryMessagingTransport,
} from "../src/messaging/relay/memory-transport.js";

describe(
  "VINSS messaging relay contract",
  () => {
    it(
      "stores and fetches KeyPackages",
      async () => {
        const relay =
          new MemoryMessagingTransport();

        await relay.publishKeyPackage({
          installationId: "bob-phone",
          createdAt: 10,
          expiresAt: 20,
          keyPackage:
            new Uint8Array([1, 2]),
        });

        const result =
          await relay.fetchKeyPackages([
            "bob-phone",
          ]);

        expect(result).toHaveLength(1);

        expect(
          result[0]?.keyPackage,
        ).toEqual(
          new Uint8Array([1, 2]),
        );
      },
    );

    it(
      "assigns ordered per-installation handshake sequences",
      async () => {
        const relay =
          new MemoryMessagingTransport();

        await relay.publishHandshakes([
          {
            kind: "welcome",
            conversationId: "deal-1",
            senderInstallationId:
              "alice-phone",
            recipientInstallationId:
              "bob-phone",
            sentAt: 1,
            payload:
              new Uint8Array([10]),
            context: {
              metadata: {
                conversationId:
                  "deal-1",
                title: "Deal",
                createdAt: 1,
                createdBy: "alice",
              },
              members: [
                {
                  userId: "bob",
                  installationId:
                    "bob-phone",
                  role: "member",
                  credential:
                    new Uint8Array([2]),
                },
              ],
            },
          },
        ]);

        await relay.publishHandshakes([
          {
            kind: "commit",
            conversationId: "deal-1",
            senderInstallationId:
              "alice-phone",
            recipientInstallationId:
              "bob-phone",
            sentAt: 2,
            payload:
              new Uint8Array([20]),
            change: {
              type: "remove",
              installationId:
                "charlie-phone",
            },
          },
        ]);

        const first =
          await relay.fetchHandshakes(
            "bob-phone",
          );

        expect(
          first.items.map(
            (item) => item.sequence,
          ),
        ).toEqual([1n, 2n]);

        expect(
          first.nextCursor,
        ).toBe("h:2");

        const empty =
          await relay.fetchHandshakes(
            "bob-phone",
            first.nextCursor,
          );

        expect(
          empty.items,
        ).toEqual([]);
      },
    );

    it(
      "rejects the whole invalid handshake batch",
      async () => {
        const relay =
          new MemoryMessagingTransport();

        await expect(
          relay.publishHandshakes([
            {
              kind: "commit",
              conversationId:
                "deal-1",
              senderInstallationId:
                "alice-phone",
              recipientInstallationId:
                "bob-phone",
              sentAt: 1,
              payload:
                new Uint8Array([1]),
              change: {
                type: "remove",
                installationId:
                  "charlie-phone",
              },
            },
            {
              kind: "commit",
              conversationId:
                "deal-1",
              senderInstallationId:
                "alice-phone",
              recipientInstallationId:
                "charlie-phone",
              sentAt: 1,
              payload:
                new Uint8Array(),
              change: {
                type: "remove",
                installationId:
                  "bob-phone",
              },
            },
          ]),
        ).rejects.toThrow(
          "payload cannot be empty",
        );

        const bob =
          await relay.fetchHandshakes(
            "bob-phone",
          );

        expect(
          bob.items,
        ).toEqual([]);
      },
    );

    it(
      "delivers ciphertext using conversation cursors",
      async () => {
        const relay =
          new MemoryMessagingTransport();

        await relay.publishCiphertext({
          id: "message-1",
          conversationId: "deal-1",
          senderInstallationId:
            "alice-phone",
          epoch: 4n,
          sentAt: 1,
          payload:
            new Uint8Array([99]),
        });

        const first =
          await relay.fetchCiphertexts(
            "deal-1",
          );

        expect(
          first.items,
        ).toHaveLength(1);

        expect(
          first.nextCursor,
        ).toBe("c:1");

        const second =
          await relay.fetchCiphertexts(
            "deal-1",
            "c:1",
          );

        expect(
          second.items,
        ).toEqual([]);
      },
    );
  },
);
