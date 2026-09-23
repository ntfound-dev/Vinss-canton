import {
  describe,
  expect,
  it,
} from "vitest";

import {
  decodeSecurePayload,
  encodeSecurePayload,
} from "../src/messaging/content.js";

describe(
  "VINSS encrypted application payload",
  () => {
    it(
      "round-trips private group state including roles and credentials",
      () => {
        const encoded =
          encodeSecurePayload({
            kind:
              "group_state",
            snapshot: {
              metadata: {
                conversationId:
                  "opaque-123",
                title:
                  "Secret Deal",
                createdAt: 10,
                createdBy:
                  "alice",
              },
              epoch: 4n,
              members: [
                {
                  userId:
                    "alice",
                  installationId:
                    "alice-phone",
                  role:
                    "super_admin",
                  credential:
                    new Uint8Array(
                      [1, 2],
                    ),
                },
              ],
            },
          });

        const decoded =
          decodeSecurePayload(
            encoded,
          );

        expect(
          decoded.kind,
        ).toBe(
          "group_state",
        );

        if (
          decoded.kind !==
          "group_state"
        ) {
          throw new Error(
            "Unexpected payload kind",
          );
        }

        expect(
          decoded.snapshot
            .metadata.title,
        ).toBe(
          "Secret Deal",
        );

        expect(
          decoded.snapshot
            .epoch,
        ).toBe(4n);

        expect(
          decoded.snapshot
            .members[0]
            ?.credential,
        ).toEqual(
          new Uint8Array(
            [1, 2],
          ),
        );
      },
    );
  },
);

describe(
  "VINSS encrypted deal proposal payload",
  () => {
    it(
      "round-trips the private proposal with its Canton contract locator",
      () => {
        const encoded =
          encodeSecurePayload({
            kind: "message",

            message: {
              id: "offer-message-1",
              conversationId: "deal-room-1",
              senderUserId: "alice",
              senderInstallationId:
                "alice-phone",
              sentAt: 10,

              content: {
                type:
                  "deal_proposal",
                dealId:
                  "deal-1",
                canonicalTerms:
                  '{"amount":"100","instrumentId":"USD","terms":"Private work","expiresAt":"2026-09-25T00:00:00.000Z"}',
                termsHash:
                  "abc123",
                cantonContractId:
                  "contract-1",
              },
            },
          });

        const decoded =
          decodeSecurePayload(
            encoded,
          );

        expect(
          decoded.kind,
        ).toBe("message");

        if (
          decoded.kind !==
          "message"
        ) {
          throw new Error(
            "Unexpected payload kind",
          );
        }

        expect(
          decoded.message
            .content.type,
        ).toBe(
          "deal_proposal",
        );

        if (
          decoded.message
            .content.type !==
          "deal_proposal"
        ) {
          throw new Error(
            "Unexpected content type",
          );
        }

        expect(
          decoded.message
            .content
            .cantonContractId,
        ).toBe(
          "contract-1",
        );
      },
    );
  },
);
