import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  syncMlsHandshakes,
} from "../src/messaging/openmls/handshake-sync.js";

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
  "MLS handshake sync",
  () => {
    it(
      "joins from Welcome before later processing Commits",
      async () => {
        const joinFromWelcome =
          vi.fn()
            .mockResolvedValue({});

        const processHandshake =
          vi.fn()
            .mockResolvedValue({});

        const bridge = {
          joinFromWelcome,
          processHandshake,
        } as unknown as
          OpenMlsBridge;

        const transport = {
          fetchHandshakes:
            vi.fn()
              .mockResolvedValue({
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
                      members: [
                        {
                          userId:
                            "alice",
                          installationId:
                            "alice-phone",
                          credential:
                            new Uint8Array(
                              [1],
                            ),
                          role:
                            "super_admin",
                        },
                        {
                          userId:
                            "bob",
                          installationId:
                            "bob-phone",
                          credential:
                            new Uint8Array(
                              [2],
                            ),
                          role:
                            "member",
                        },
                      ],
                    },
                  },
                  {
                    id: "commit-2",
                    sequence: 2n,
                    conversationId:
                      "deal-1",
                    kind: "commit",
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
                        "alice-old-device",
                    },
                  },
                ],
                nextCursor:
                  "cursor-2",
              }),
        } as unknown as
          MessagingTransport;

        const result =
          await syncMlsHandshakes({
            bridge,
            transport,
            identity,
          });

        expect(
          joinFromWelcome,
        ).toHaveBeenCalledTimes(1);

        expect(
          processHandshake,
        ).toHaveBeenCalledTimes(1);

        expect(
          joinFromWelcome
            .mock
            .invocationCallOrder[0],
        ).toBeLessThan(
          processHandshake
            .mock
            .invocationCallOrder[0]!,
        );

        expect(result).toEqual({
          processed: 2,
          nextCursor:
            "cursor-2",
        });
      },
    );

    it(
      "rejects out-of-order relay sequences",
      async () => {
        const bridge =
          {} as OpenMlsBridge;

        const transport = {
          fetchHandshakes:
            vi.fn()
              .mockResolvedValue({
                items: [
                  {
                    id: "a",
                    sequence: 5n,
                    recipientInstallationId:
                      "bob-phone",
                  },
                  {
                    id: "b",
                    sequence: 4n,
                    recipientInstallationId:
                      "bob-phone",
                  },
                ],
              }),
        } as unknown as
          MessagingTransport;

        await expect(
          syncMlsHandshakes({
            bridge,
            transport,
            identity,
          }),
        ).rejects.toThrow(
          "sequence is not strictly increasing",
        );
      },
    );
  },
);

describe(
  "MLS handshake replay protection",
  () => {
    it(
      "skips a handshake already committed to durable MLS state",
      async () => {
        const joinFromWelcome =
          vi.fn();

        const bridge = {
          hasProcessedHandshake:
            vi.fn()
              .mockResolvedValue(
                true,
              ),

          joinFromWelcome,
        } as unknown as
          OpenMlsBridge;

        const transport = {
          fetchHandshakes:
            vi.fn()
              .mockResolvedValue({
                items: [
                  {
                    id:
                      "welcome-already-done",

                    sequence:
                      9n,

                    conversationId:
                      "deal-replay",

                    kind:
                      "welcome",

                    senderInstallationId:
                      "alice-phone",

                    recipientInstallationId:
                      "bob-phone",

                    sentAt:
                      9,

                    payload:
                      new Uint8Array(
                        [99],
                      ),
                  },
                ],

                nextCursor:
                  "h:9",
              }),
        } as unknown as
          MessagingTransport;

        const result =
          await syncMlsHandshakes({
            bridge,
            transport,
            identity,
          });

        expect(
          joinFromWelcome,
        ).not.toHaveBeenCalled();

        expect(result).toEqual({
          processed: 0,
          nextCursor:
            "h:9",
        });
      },
    );
  },
);
