import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";

import {
  HttpCantonLedgerClient,
} from "../../dist/canton/http-ledger-client.js";

import {
  CantonMessagingTransport,
} from "../../dist/messaging/canton/transport.js";

import {
  BrowserOpenMlsBridge,
} from "../../dist/messaging/openmls/browser-bridge.js";

import {
  OpenMlsMessagingProvider,
} from "../../dist/messaging/openmls/provider.js";

const require =
  createRequire(
    import.meta.url,
  );

const wasm =
  require(
    "../../wasm/vinss_mls/pkg-node/vinss_mls.js",
  );

const BASE =
  process.env.CANTON_BASE_URL ??
  "http://127.0.0.1:7575";

const USER =
  "ledger-api-user";

const CONVERSATION =
  `vinss-e2e-${crypto.randomUUID()}`;

const loadWasm =
  async () => wasm;

async function request(
  path,
  init = {},
) {
  const response =
    await fetch(
      `${BASE}${path}`,
      {
        ...init,

        headers: {
          accept:
            "application/json",

          ...(init.body
            ? {
                "content-type":
                  "application/json",
              }
            : {}),

          ...init.headers,
        },
      },
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `${path} -> ${response.status}: ${text}`,
    );
  }

  return text
    ? JSON.parse(text)
    : undefined;
}

async function connectedSynchronizerId() {
  const result =
    await request(
      "/v2/state/connected-synchronizers",
    );

  const synchronizers =
    result
      ?.connectedSynchronizers;

  assert.ok(
    Array.isArray(
      synchronizers,
    ) &&
      synchronizers.length > 0,
    "No connected Canton synchronizer",
  );

  const id =
    synchronizers[0]
      ?.synchronizerId;

  assert.equal(
    typeof id,
    "string",
  );

  return id;
}

async function allocateParty(
  hint,
  synchronizerId,
) {
  const result =
    await request(
      "/v2/parties",
      {
        method: "POST",

        body: JSON.stringify({
          partyIdHint:
            hint,

          identityProviderId:
            "",

          synchronizerId,
        }),
      },
    );

  const party =
    result
      ?.partyDetails
      ?.party;

  assert.equal(
    typeof party,
    "string",
    `Failed to allocate ${hint}`,
  );

  return party;
}

class TestDirectory {
  constructor({
    activeParty,
    partyByInstallation,
    recipients,
    keyPackageReaders,
  }) {
    this.party =
      activeParty;

    this.partyByInstallation =
      partyByInstallation;

    this.recipients =
      recipients;

    this.readers =
      keyPackageReaders;
  }

  activeParty() {
    return this.party;
  }

  async partyForInstallation(
    installationId,
  ) {
    const party =
      this.partyByInstallation
        .get(
          installationId,
        );

    if (!party) {
      throw new Error(
        `Unknown installation: ${installationId}`,
      );
    }

    return party;
  }

  async recipientsForConversation(
    conversationId,
  ) {
    assert.equal(
      conversationId,
      CONVERSATION,
    );

    return this.recipients;
  }

  async keyPackageReaders() {
    return this.readers;
  }
}

const synchronizerId =
  await connectedSynchronizerId();

const aliceParty =
  await allocateParty(
    `Alice-${crypto.randomUUID().slice(0, 8)}`,
    synchronizerId,
  );

const bobParty =
  await allocateParty(
    `Bob-${crypto.randomUUID().slice(0, 8)}`,
    synchronizerId,
  );

const charlieParty =
  await allocateParty(
    `Charlie-${crypto.randomUUID().slice(0, 8)}`,
    synchronizerId,
  );

console.log(
  "Synchronizer:",
  synchronizerId,
);

console.log(
  "Alice:",
  aliceParty,
);

console.log(
  "Bob:",
  bobParty,
);

console.log(
  "Charlie:",
  charlieParty,
);

const aliceIdentity = {
  userId: "alice",
  installationId:
    "alice-browser",
  credential:
    new Uint8Array([1]),
};

const bobIdentity = {
  userId: "bob",
  installationId:
    "bob-browser",
  credential:
    new Uint8Array([2]),
};

const aliceMember = {
  ...aliceIdentity,
  role:
    "super_admin",
};

const bobMember = {
  ...bobIdentity,
  role:
    "member",
};

const partyByInstallation =
  new Map([
    [
      aliceIdentity
        .installationId,
      aliceParty,
    ],
    [
      bobIdentity
        .installationId,
      bobParty,
    ],
  ]);

const aliceLedger =
  new HttpCantonLedgerClient({
    baseUrl: BASE,
    userId: USER,
  });

const bobLedger =
  new HttpCantonLedgerClient({
    baseUrl: BASE,
    userId: USER,
  });

const charlieLedger =
  new HttpCantonLedgerClient({
    baseUrl: BASE,
    userId: USER,
  });

const aliceDirectory =
  new TestDirectory({
    activeParty:
      aliceParty,

    partyByInstallation,

    recipients: [
      bobParty,
    ],

    keyPackageReaders: [
      bobParty,
    ],
  });

const bobDirectory =
  new TestDirectory({
    activeParty:
      bobParty,

    partyByInstallation,

    recipients: [
      aliceParty,
    ],

    keyPackageReaders: [
      aliceParty,
    ],
  });

const aliceTransport =
  new CantonMessagingTransport(
    aliceLedger,
    aliceDirectory,
  );

const bobTransport =
  new CantonMessagingTransport(
    bobLedger,
    bobDirectory,
  );

const aliceBridge =
  new BrowserOpenMlsBridge(
    loadWasm,
  );

const bobBridge =
  new BrowserOpenMlsBridge(
    loadWasm,
  );

const aliceProvider =
  new OpenMlsMessagingProvider(
    aliceBridge,
    aliceTransport,
  );

const bobProvider =
  new OpenMlsMessagingProvider(
    bobBridge,
    bobTransport,
  );

// Both installations generate real MLS credentials
// and publish real KeyPackages through Canton.
await aliceProvider.initialize(
  aliceIdentity,
);

await bobProvider.initialize(
  bobIdentity,
);

console.log(
  "MLS KeyPackages published through Canton",
);

const initial =
  await aliceProvider.createGroup({
    conversationId:
      CONVERSATION,

    title:
      "VINSS Canton E2E",

    creator:
      aliceMember,
  });

assert.equal(
  initial.members.length,
  1,
);

const aliceAfterAdd =
  await aliceProvider.addMembers(
    CONVERSATION,
    [
      bobMember,
    ],
  );

assert.equal(
  aliceAfterAdd.members.length,
  2,
);

assert.ok(
  aliceAfterAdd.members.some(
    (member) =>
      member.installationId ===
      bobIdentity.installationId,
  ),
);

// This call must:
// 1. read Welcome from Canton /v2/updates
// 2. join Bob's real MLS group
// 3. read encrypted group_state
// 4. decrypt it with Bob's MLS state.
const bobInitialSync =
  await bobProvider.sync(
    CONVERSATION,
  );

assert.equal(
  bobInitialSync.messages.length,
  0,
);

assert.equal(
  typeof bobInitialSync.nextCursor,
  "string",
  "Bob did not receive encrypted group state",
);

const bobSnapshot =
  await bobBridge
    .getGroupSnapshot(
      CONVERSATION,
    );

assert.equal(
  bobSnapshot.metadata.title,
  "VINSS Canton E2E",
);

assert.equal(
  bobSnapshot.members.length,
  2,
);

assert.equal(
  bobSnapshot.epoch,
  aliceAfterAdd.epoch,
);

console.log(
  "REAL MLS WELCOME THROUGH CANTON: PASS",
);

const messageId =
  crypto.randomUUID();

const plaintext =
  "Hello Bob — this crossed real Canton as MLS ciphertext";

await aliceProvider.send({
  id:
    messageId,

  conversationId:
    CONVERSATION,

  senderUserId:
    aliceIdentity.userId,

  senderInstallationId:
    aliceIdentity.installationId,

  sentAt:
    Date.now(),

  content: {
    type:
      "text",

    text:
      plaintext,
  },
});

const bobMessageSync =
  await bobProvider.sync(
    CONVERSATION,
    bobInitialSync.nextCursor,
  );

assert.equal(
  bobMessageSync.messages.length,
  1,
  "Bob did not decrypt exactly one VINSS message",
);

const received =
  bobMessageSync.messages[0];

assert.ok(
  received,
);

assert.equal(
  received.id,
  messageId,
);

assert.equal(
  received.senderUserId,
  "alice",
);

assert.equal(
  received
    .senderInstallationId,
  "alice-browser",
);

assert.equal(
  received.content.type,
  "text",
);

assert.equal(
  received.content.text,
  plaintext,
);

console.log(
  "REAL OPENMLS → CANTON → OPENMLS DECRYPT: PASS",
);

// Confirm the actual Canton contract exists for Bob.
const bobContracts =
  await bobLedger
    .queryActiveContracts(
      bobParty,
    );

const bobMessageContract =
  bobContracts.find(
    (contract) =>
      contract.templateId.endsWith(
        ":Vinss.Messaging:EncryptedMessage",
      ) &&
      contract
        .createArgument
        .messageId ===
        messageId,
  );

assert.ok(
  bobMessageContract,
  "Bob cannot observe the Canton EncryptedMessage contract",
);

// Canton must only contain ciphertext, not our plaintext.
assert.notEqual(
  bobMessageContract
    .createArgument
    .ciphertextB64,
  Buffer.from(
    plaintext,
  ).toString(
    "base64",
  ),
);

const charlieContracts =
  await charlieLedger
    .queryActiveContracts(
      charlieParty,
    );

const charlieSawConversation =
  charlieContracts.some(
    (contract) => {
      const args =
        contract
          .createArgument;

      return (
        (
          contract.templateId.endsWith(
            ":Vinss.Messaging:MlsDelivery",
          ) ||
          contract.templateId.endsWith(
            ":Vinss.Messaging:EncryptedMessage",
          )
        ) &&
        args.channelId ===
          CONVERSATION
      );
    },
  );

assert.equal(
  charlieSawConversation,
  false,
  "Unrelated Charlie received VINSS private conversation data",
);

console.log(
  "UNRELATED CANTON PARTY VISIBILITY: BLOCKED",
);

console.log(
  "VINSS TRUE CANTON + OPENMLS E2E: PASS",
);
