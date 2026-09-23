import {
  describe,
  expect,
  it,
} from "vitest";

import {
  decodeOpenMlsCheckpoint,
  encodeOpenMlsCheckpoint,
} from "../src/messaging/openmls/checkpoint.js";

describe(
  "OpenMLS checkpoint",
  () => {
    it(
      "roundtrips private storage and group state",
      () => {
        const encoded =
          encodeOpenMlsCheckpoint({
            version: 1,

            identityKey:
              "alice:phone",

            identityPublicKey:
              new Uint8Array(
                [1, 2, 3],
              ),

            providerStorage:
              new Uint8Array(
                [9, 8, 7],
              ),

            handshakeCursor:
              "h:42",

            processedHandshakeIds: [
              "welcome-1",
              "commit-2",
            ],

            groups: [
              {
                hydrated: true,

                snapshot: {
                  metadata: {
                    conversationId:
                      "deal-1",

                    title:
                      "Private deal",

                    createdAt: 123,

                    createdBy:
                      "alice",
                  },

                  epoch: 7n,

                  members: [
                    {
                      userId:
                        "alice",

                      installationId:
                        "phone",

                      role:
                        "admin",

                      credential:
                        new Uint8Array(
                          [4, 5],
                        ),
                    },
                  ],
                },
              },
            ],
          });

        const decoded =
          decodeOpenMlsCheckpoint(
            encoded,
          );

        expect(
          decoded.identityKey,
        ).toBe(
          "alice:phone",
        );

        expect(
          decoded.providerStorage,
        ).toEqual(
          new Uint8Array(
            [9, 8, 7],
          ),
        );

        expect(
          decoded.groups[0]
            ?.snapshot.epoch,
        ).toBe(7n);

        expect(
          decoded.groups[0]
            ?.snapshot.members[0]
            ?.credential,
        ).toEqual(
          new Uint8Array(
            [4, 5],
          ),
        );
      },
    );
  },
);
