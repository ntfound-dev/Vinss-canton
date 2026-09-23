import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  CantonWebSocketUpdateStream,
} from "../src/canton/websocket-update-stream.js";

class FakeSocket {
  onopen:
    | (() => void)
    | null = null;

  onmessage:
    | ((
        event: {
          data: unknown;
        },
      ) => void)
    | null = null;

  onerror:
    | ((event: unknown) => void)
    | null = null;

  onclose:
    | (() => void)
    | null = null;

  readonly sent:
    string[] = [];

  closed = false;

  send(
    data: string,
  ): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.onclose?.();
  }

  open(): void {
    this.onopen?.();
  }

  message(
    data: unknown,
  ): void {
    this.onmessage?.({
      data,
    });
  }
}

describe(
  "Canton WebSocket update stream",
  () => {
    it(
      "subscribes from an offset and parses created contracts",
      async () => {
        const socket =
          new FakeSocket();

        const protocols:
          string[][] = [];

        const onBatch =
          vi.fn();

        const stream =
          new CantonWebSocketUpdateStream({
            baseUrl:
              "https://canton.example",

            async getAccessToken() {
              return "token-123";
            },

            createWebSocket(
              _url,
              selectedProtocols,
            ) {
              protocols.push(
                [
                  ...selectedProtocols,
                ],
              );

              return socket;
            },
          });

        const subscriptionPromise =
          stream.subscribe({
            party:
              "Bob::party",

            afterExclusive:
              41n,

            onBatch,
          });

        await Promise.resolve();

        socket.open();

        const subscription =
          await subscriptionPromise;

        expect(
          protocols[0],
        ).toEqual([
          "daml.ws.auth",
          "jwt.token.token-123",
        ]);

        const request =
          JSON.parse(
            socket.sent[0]!,
          );

        expect(
          request
            .beginExclusive,
        ).toBe(41);

        socket.message(
          JSON.stringify({
            update: {
              Transaction: {
                value: {
                  offset: 42,

                  events: [
                    {
                      CreatedEvent: {
                        offset: 42,

                        contractId:
                          "contract-1",

                        templateId:
                          "abc:Vinss.Messaging:MlsDelivery",

                        packageName:
                          "vinss-canton-messaging",

                        createArgument: {
                          channelId:
                            "deal-1",
                        },
                      },
                    },
                  ],
                },
              },
            },
          }),
        );

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              0,
            ),
        );

        expect(
          onBatch,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          onBatch.mock
            .calls[0]?.[0]
            .offset,
        ).toBe(42n);

        subscription.close();

        expect(
          socket.closed,
        ).toBe(true);
      },
    );
  },
);
