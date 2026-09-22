import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildAddHandshakeDeliveries,
  buildRemoveHandshakeDeliveries,
} from "../src/messaging/openmls/handshake.js";

import type {
  GroupMember,
  GroupSnapshot,
  MessagingIdentity,
} from "../src/messaging/types.js";

const aliceIdentity:
  MessagingIdentity = {
    userId: "alice",
    installationId: "alice-phone",
    credential:
      new Uint8Array([1]),
  };

const alice: GroupMember = {
  ...aliceIdentity,
  role: "super_admin",
};

const bob: GroupMember = {
  userId: "bob",
  installationId: "bob-phone",
  credential:
    new Uint8Array([2]),
  role: "member",
};

const charlie: GroupMember = {
  userId: "charlie",
  installationId: "charlie-phone",
  credential:
    new Uint8Array([3]),
  role: "member",
};

function snapshot(
  members:
    readonly GroupMember[],
): GroupSnapshot {
  return {
    metadata: {
      conversationId:
        "deal-123",
      title: "Private Deal",
      createdAt: 1,
      createdBy: "alice",
    },
    epoch: 4n,
    members,
  };
}

describe(
  "MLS handshake routing",
  () => {
    it(
      "sends commit to existing members and Welcome only to the new member",
      () => {
        const deliveries =
          buildAddHandshakeDeliveries({
            sender:
              aliceIdentity,
            snapshot:
              snapshot([
                alice,
                bob,
              ]),
            newMember:
              charlie,
            commit:
              new Uint8Array([10]),
            welcome:
              new Uint8Array([20]),
            sentAt: 100,
          });

        expect(
          deliveries,
        ).toHaveLength(2);

        expect(
          deliveries[0],
        ).toMatchObject({
          kind: "commit",
          recipientInstallationId:
            "bob-phone",
        });

        expect(
          deliveries[1],
        ).toMatchObject({
          kind: "welcome",
          recipientInstallationId:
            "charlie-phone",
        });
      },
    );

    it(
      "does not send removal commit to the removed installation",
      () => {
        const deliveries =
          buildRemoveHandshakeDeliveries({
            sender:
              aliceIdentity,
            snapshot:
              snapshot([
                alice,
                bob,
                charlie,
              ]),
            removedInstallationId:
              "bob-phone",
            commit:
              new Uint8Array([30]),
            sentAt: 200,
          });

        expect(
          deliveries.map(
            (item) =>
              item
                .recipientInstallationId,
          ),
        ).toEqual([
          "charlie-phone",
        ]);
      },
    );
  },
);
