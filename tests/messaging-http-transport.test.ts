import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  decodeRelayJson,
  encodeRelayJson,
} from "../src/messaging/relay/http-codec.js";

import {
  HttpMessagingTransport,
} from "../src/messaging/relay/http-transport.js";

describe(
  "VINSS HTTP messaging transport",
  () => {
    it(
      "preserves bytes and bigint over relay JSON",
      () => {
        const original = {
          epoch: 42n,
          payload:
            new Uint8Array([
              1,
              2,
              255,
            ]),
        };

        const decoded =
          decodeRelayJson<
            typeof original
          >(
            encodeRelayJson(
              original,
            ),
          );

        expect(
          decoded.epoch,
        ).toBe(42n);

        expect(
          decoded.payload,
        ).toEqual(
          new Uint8Array([
            1,
            2,
            255,
          ]),
        );
      },
    );

    it(
      "publishes ciphertext with the relay wire codec",
      async () => {
        const fetcher =
          vi.fn(
            async (
              _input:
                RequestInfo |
                URL,
              init?: RequestInit,
            ) => {
              const body =
                decodeRelayJson<{
                  epoch: bigint;
                  payload:
                    Uint8Array;
                }>(
                  String(
                    init?.body,
                  ),
                );

              expect(
                body.epoch,
              ).toBe(7n);

              expect(
                body.payload,
              ).toEqual(
                new Uint8Array([
                  9,
                  8,
                ]),
              );

              return new Response(
                null,
                {
                  status: 204,
                },
              );
            },
          );

        const transport =
          new HttpMessagingTransport(
            "https://relay.example",
            fetcher,
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
              new Uint8Array([
                9,
                8,
              ]),
          });

        expect(
          fetcher,
        ).toHaveBeenCalledOnce();
      },
    );

    it(
      "decodes handshake sequence and payload from HTTP",
      async () => {
        const fetcher =
          vi.fn(
            async () =>
              new Response(
                encodeRelayJson({
                  items: [
                    {
                      id: "hs:1",
                      sequence: 3n,
                      conversationId:
                        "deal-1",
                      kind:
                        "commit",
                      senderInstallationId:
                        "alice-phone",
                      recipientInstallationId:
                        "bob-phone",
                      sentAt: 1,
                      payload:
                        new Uint8Array(
                          [5],
                        ),
                      change: {
                        type:
                          "remove",
                        installationId:
                          "charlie-phone",
                      },
                    },
                  ],
                  nextCursor:
                    "h:3",
                }),
                {
                  status: 200,
                  headers: {
                    "content-type":
                      "application/json",
                  },
                },
              ),
          );

        const transport =
          new HttpMessagingTransport(
            "https://relay.example/",
            fetcher,
          );

        const result =
          await transport
            .fetchHandshakes(
              "bob-phone",
            );

        expect(
          result.items[0]
            ?.sequence,
        ).toBe(3n);

        expect(
          result.items[0]
            ?.payload,
        ).toEqual(
          new Uint8Array([5]),
        );

        expect(
          result.nextCursor,
        ).toBe("h:3");
      },
    );
  },
);
