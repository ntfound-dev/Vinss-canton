import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  OpenMlsMessagingProvider,
} from "../src/messaging/openmls/provider.js";

import type {
  OpenMlsBridge,
} from "../src/messaging/openmls/bridge.js";

import type {
  MessagingTransport,
} from "../src/messaging/transport.js";

const identity = {
  userId: "bob",
  installationId: "bob-phone",
  credential:
    new Uint8Array([2]),
};

describe(
  "OpenMLS provider sync",
  () => {
    it(
      "processes MLS handshakes before ciphertext and advances handshake cursor",
      async () => {
        const joinFromWelcome =
          vi.fn()
            .mockResolvedValue({
              metadata: {
                conversationId:
                  "deal-1",
                title:
                  "Private Deal",
                createdAt: 1,
                createdBy:
                  "alice",
              },
              epoch: 1n,
              members: [],
            });

        const bridge = {
          initialize:
            vi.fn()
              .mockResolvedValue(
                undefined,
              ),

          createKeyPackage:
            vi.fn()
              .mockResolvedValue(
                new Uint8Array([9]),
              ),

          joinFromWelcome,
        } as unknown as
          OpenMlsBridge;

        const fetchHandshakes =
          vi.fn()
            .mockResolvedValueOnce({
              items: [
                {
                  id: "welcome-1",
                  sequence: 1n,
                  conversationId:
                    "deal-1",
                  kind: "welcome",
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
                      title:
                        "Private Deal",
                      createdAt: 1,
                      createdBy:
                        "alice",
                    },
                    members: [],
                  },
                },
              ],
              nextCursor:
                "handshake-1",
            })
            .mockResolvedValueOnce({
              items: [],
            });

        const fetchCiphertexts =
          vi.fn()
            .mockResolvedValue({
              items: [],
            });

        const transport = {
          publishKeyPackage:
            vi.fn()
              .mockResolvedValue(
                undefined,
              ),

          fetchHandshakes,

          fetchCiphertexts,
        } as unknown as
          MessagingTransport;

        const provider =
          new OpenMlsMessagingProvider(
            bridge,
            transport,
          );

        await provider.initialize(
          identity,
        );

        await provider.sync(
          "deal-1",
        );

        expect(
          joinFromWelcome,
        ).toHaveBeenCalledTimes(1);

        expect(
          joinFromWelcome
            .mock
            .invocationCallOrder[0]!,
        ).toBeLessThan(
          fetchCiphertexts
            .mock
            .invocationCallOrder[0]!,
        );

        await provider.sync(
          "deal-1",
        );

        expect(
          fetchHandshakes,
        ).toHaveBeenNthCalledWith(
          2,
          "bob-phone",
          "handshake-1",
        );
      },
    );

    it(
      "skips ciphertext sent by the active installation",
      async () => {
        const decrypt =
          vi.fn();

        const bridge = {
          initialize:
            vi.fn()
              .mockResolvedValue(
                undefined,
              ),

          createKeyPackage:
            vi.fn()
              .mockResolvedValue(
                new Uint8Array([9]),
              ),

          decryptApplicationMessage:
            decrypt,
        } as unknown as
          OpenMlsBridge;

        const transport = {
          publishKeyPackage:
            vi.fn()
              .mockResolvedValue(
                undefined,
              ),

          fetchHandshakes:
            vi.fn()
              .mockResolvedValue({
                items: [],
              }),

          fetchCiphertexts:
            vi.fn()
              .mockResolvedValue({
                items: [
                  {
                    id: "own-message",
                    conversationId:
                      "deal-1",
                    senderInstallationId:
                      "bob-phone",
                    epoch: 1n,
                    sentAt: 1,
                    payload:
                      new Uint8Array([1]),
                  },
                ],
                nextCursor:
                  "ciphertext-1",
              }),
        } as unknown as
          MessagingTransport;

        const provider =
          new OpenMlsMessagingProvider(
            bridge,
            transport,
          );

        await provider.initialize(
          identity,
        );

        const result =
          await provider.sync(
            "deal-1",
          );

        expect(
          decrypt,
        ).not.toHaveBeenCalled();

        expect(
          result.messages,
        ).toEqual([]);

        expect(
          result.nextCursor,
        ).toBe(
          "ciphertext-1",
        );
      },
    );
  },
);
