import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

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
      "wakes OpenMLS sync when Canton emits a relevant contract",
      async () => {
        let emit:
          | Parameters<
              CantonUpdateStream[
                "subscribe"
              ]
            >[0]["onBatch"]
          | undefined;

        const updates:
          CantonUpdateStream = {
            async subscribe(
              input,
            ) {
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
                "c:50",
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
            directory,
            "bob-phone",
          );

        await session.start({
          afterExclusive:
            41n,

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
