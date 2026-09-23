import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  CantonLedgerClient,
} from "../src/canton/ledger-client.js";

import type {
  CantonUpdateStream,
} from "../src/canton/update-stream.js";

import {
  CantonLiveMessagingSession,
} from "../src/messaging/canton/live-session.js";

import type {
  CantonMessagingDirectory,
} from "../src/messaging/canton/directory.js";

import type {
  SecureMessagingProvider,
} from "../src/messaging/provider.js";

describe(
  "Canton live messaging session",
  () => {
    it(
      "bootstraps ACS at offset X before subscribing from X",
      async () => {
        const order:
          string[] = [];

        let subscribedFrom:
          bigint | undefined;

        const ledger = {
          async queryActiveContractsSnapshot() {
            order.push(
              "snapshot",
            );

            return {
              offset: 41n,

              contracts: [
                {
                  contractId:
                    "delivery-bootstrap",

                  templateId:
                    "abc:Vinss.Messaging:MlsDelivery",

                  offset: 41n,

                  createArgument: {
                    channelId:
                      "deal-1",

                    recipient:
                      "Bob::party",

                    recipientInstallationId:
                      "bob-phone",
                  },
                },
              ],
            };
          },
        } as unknown as
          CantonLedgerClient;

        const updates:
          CantonUpdateStream = {
            async subscribe(
              input,
            ) {
              order.push(
                "subscribe",
              );

              subscribedFrom =
                input.afterExclusive;

              return {
                close() {},
              };
            },
          };

        const sync =
          vi.fn()
            .mockImplementation(
              async () => {
                order.push(
                  "sync",
                );

                return {
                  messages: [],
                  nextCursor:
                    "c:41",
                };
              },
            );

        const provider = {
          sync,
        } as unknown as
          SecureMessagingProvider;

        const directory = {
          activeParty() {
            return "Bob::party";
          },
        } as unknown as
          CantonMessagingDirectory;

        const session =
          new CantonLiveMessagingSession(
            provider,
            updates,
            ledger,
            directory,
            "bob-phone",
          );

        await session.start({
          onMessages:
            vi.fn(),
        });

        expect(order).toEqual([
          "snapshot",
          "sync",
          "subscribe",
        ]);

        expect(
          subscribedFrom,
        ).toBe(41n);

        expect(
          sync,
        ).toHaveBeenCalledWith(
          "deal-1",
          undefined,
        );
      },
    );

    it(
      "reconnects from the last processed Canton offset",
      async () => {
        vi.useFakeTimers();

        try {
          const offsets:
            bigint[] = [];

          let firstOnBatch:
            | Parameters<
                CantonUpdateStream[
                  "subscribe"
                ]
              >[0]["onBatch"]
            | undefined;

          let firstOnClose:
            | (() => void)
            | undefined;

          const ledger = {
            async queryActiveContractsSnapshot() {
              return {
                offset: 41n,
                contracts: [],
              };
            },
          } as unknown as
            CantonLedgerClient;

          const updates:
            CantonUpdateStream = {
              async subscribe(
                input,
              ) {
                offsets.push(
                  input.afterExclusive,
                );

                if (
                  offsets.length ===
                  1
                ) {
                  firstOnBatch =
                    input.onBatch;

                  firstOnClose =
                    input.onClose;
                }

                return {
                  close() {},
                };
              },
            };

          const provider = {
            sync:
              vi.fn()
                .mockResolvedValue({
                  messages: [],
                }),
          } as unknown as
            SecureMessagingProvider;

          const directory = {
            activeParty() {
              return "Bob::party";
            },
          } as unknown as
            CantonMessagingDirectory;

          const session =
            new CantonLiveMessagingSession(
              provider,
              updates,
              ledger,
              directory,
              "bob-phone",
            );

          const subscription =
            await session.start({
              onMessages:
                vi.fn(),
            });

          if (
            !firstOnBatch ||
            !firstOnClose
          ) {
            throw new Error(
              "Initial live subscription was not created",
            );
          }

          await firstOnBatch({
            offset: 42n,
            createdContracts: [],
          });

          firstOnClose();

          await vi
            .advanceTimersByTimeAsync(
              500,
            );

          expect(
            offsets,
          ).toEqual([
            41n,
            42n,
          ]);

          subscription.close();
        } finally {
          vi.useRealTimers();
        }
      },
    );

    it(
      "wakes OpenMLS sync for updates strictly after snapshot boundary",
      async () => {
        let emit:
          | Parameters<
              CantonUpdateStream[
                "subscribe"
              ]
            >[0]["onBatch"]
          | undefined;

        const ledger = {
          async queryActiveContractsSnapshot() {
            return {
              offset: 41n,
              contracts: [],
            };
          },
        } as unknown as
          CantonLedgerClient;

        const updates:
          CantonUpdateStream = {
            async subscribe(
              input,
            ) {
              expect(
                input.afterExclusive,
              ).toBe(41n);

              emit =
                input.onBatch;

              return {
                close() {},
              };
            },
          };

        const sync =
          vi.fn()
            .mockResolvedValue({
              messages: [
                {
                  id:
                    "message-1",
                  conversationId:
                    "deal-1",
                  senderUserId:
                    "alice",
                  senderInstallationId:
                    "alice-phone",
                  sentAt: 1,
                  content: {
                    type: "text",
                    text: "hello",
                  },
                },
              ],

              nextCursor:
                "c:42",
            });

        const provider = {
          sync,
        } as unknown as
          SecureMessagingProvider;

        const directory = {
          activeParty() {
            return "Bob::party";
          },
        } as unknown as
          CantonMessagingDirectory;

        const onMessages =
          vi.fn();

        const session =
          new CantonLiveMessagingSession(
            provider,
            updates,
            ledger,
            directory,
            "bob-phone",
          );

        await session.start({
          onMessages,
        });

        if (!emit) {
          throw new Error(
            "Live stream was not subscribed",
          );
        }

        await emit({
          offset: 42n,

          createdContracts: [
            {
              contractId:
                "delivery-1",

              templateId:
                "abc:Vinss.Messaging:MlsDelivery",

              offset: 42n,

              createArgument: {
                channelId:
                  "deal-1",

                recipient:
                  "Bob::party",

                recipientInstallationId:
                  "bob-phone",
              },
            },
          ],
        });

        expect(
          sync,
        ).toHaveBeenCalledWith(
          "deal-1",
          undefined,
        );

        expect(
          onMessages,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );
  },
);
