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
