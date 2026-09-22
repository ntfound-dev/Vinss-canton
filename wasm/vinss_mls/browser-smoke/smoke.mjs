import initWasm, * as wasm from "../pkg/vinss_mls.js";

import {
  BrowserOpenMlsBridge,
} from "../../../dist/messaging/openmls/browser-bridge.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let wasmReady;

const loadWasm = async () => {
  if (!wasmReady) {
    wasmReady = initWasm().then(() => wasm);
  }

  return wasmReady;
};

const aliceIdentity = {
  userId: "alice",
  installationId: "alice-browser",
  credential: new Uint8Array([1]),
};

const bobIdentity = {
  userId: "bob",
  installationId: "bob-browser",
  credential: new Uint8Array([2]),
};

const aliceMember = {
  ...aliceIdentity,
  role: "super_admin",
};

const bobMember = {
  ...bobIdentity,
  role: "member",
};

async function run() {
  const alice =
    new BrowserOpenMlsBridge(loadWasm);

  const bob =
    new BrowserOpenMlsBridge(loadWasm);

  await alice.initialize(
    aliceIdentity,
  );

  await bob.initialize(
    bobIdentity,
  );

  const bobKeyPackage =
    await bob.createKeyPackage();

  const initial =
    await alice.createGroup({
      conversationId: "browser-deal-1",
      title: "Browser Deal",
      creator: aliceMember,
    });

  const add =
    await alice.prepareAddMember({
      conversationId: "browser-deal-1",
      member: bobMember,
      keyPackage: bobKeyPackage,
    });

  assertBytes(
    add.commit,
    "add commit",
  );

  assertBytes(
    add.welcome,
    "Welcome",
  );

  const aliceAfterAdd =
    await alice.mergePendingCommit(
      "browser-deal-1",
    );

  const bobAfterJoin =
    await bob.joinFromWelcome({
      welcome: add.welcome,
      metadata: initial.metadata,
      members: [
        aliceMember,
        bobMember,
      ],
    });

  if (
    aliceAfterAdd.epoch !==
    bobAfterJoin.epoch
  ) {
    throw new Error(
      "Alice/Bob epoch mismatch after Welcome",
    );
  }

  const encrypted =
    await alice.encryptApplicationMessage({
      conversationId:
        "browser-deal-1",
      plaintext:
        encoder.encode(
          "hello from alice",
        ),
    });

  const decrypted =
    await bob.decryptApplicationMessage({
      conversationId:
        "browser-deal-1",
      ciphertext:
        encrypted.ciphertext,
    });

  const text =
    decoder.decode(
      decrypted.plaintext,
    );

  if (
    text !==
    "hello from alice"
  ) {
    throw new Error(
      `Unexpected decrypted text: ${text}`,
    );
  }

  const removal =
    await alice.prepareRemoveMember({
      conversationId:
        "browser-deal-1",
      installationId:
        bobIdentity.installationId,
    });

  assertBytes(
    removal.commit,
    "remove commit",
  );

  const aliceAfterRemove =
    await alice.mergePendingCommit(
      "browser-deal-1",
    );

  if (
    aliceAfterRemove.members.some(
      (member) =>
        member.installationId ===
        bobIdentity.installationId,
    )
  ) {
    throw new Error(
      "Bob still exists after removal",
    );
  }

  const postRemoval =
    await alice.encryptApplicationMessage({
      conversationId:
        "browser-deal-1",
      plaintext:
        encoder.encode(
          "bob must not decrypt this",
        ),
    });

  let staleBobRejected = false;

  try {
    await bob.decryptApplicationMessage({
      conversationId:
        "browser-deal-1",
      ciphertext:
        postRemoval.ciphertext,
    });
  } catch {
    staleBobRejected = true;
  }

  if (!staleBobRejected) {
    throw new Error(
      "Removed Bob decrypted the new MLS epoch",
    );
  }

  document.body.textContent =
    "VINSS MLS BROWSER SMOKE: PASS";
}

function assertBytes(
  bytes,
  label,
) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength === 0
  ) {
    throw new Error(
      `${label} is empty`,
    );
  }
}

try {
  await run();
} catch (error) {
  const message =
    error instanceof Error
      ? error.stack ?? error.message
      : String(error);

  console.error(message);

  document.body.textContent =
    `VINSS MLS BROWSER SMOKE: FAIL — ${message}`;

  throw error;
}
