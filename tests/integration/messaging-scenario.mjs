import assert from "node:assert/strict";
import fs from "node:fs";
import { IDBFactory } from "fake-indexeddb";
import { BrowserOpenMlsBridge } from "../../dist/messaging/openmls/browser-bridge.js";
import { IndexedDbOpenMlsCheckpointStore } from "../../dist/messaging/openmls/indexeddb-checkpoint-store.js";
import { IndexedDbPlaintextStore } from "../../dist/messaging/local/plaintext-store.js";
import { OpenMlsMessagingProvider } from "../../dist/messaging/openmls/provider.js";
import { AuthenticatedCantonMessagingDirectory } from "../../dist/messaging/canton/authenticated-directory.js";
import { CantonMessagingTransport } from "../../dist/messaging/canton/transport.js";
import * as wasm from "../../frontend/lib/openmls/vinss_mls.js";
wasm.initSync({
  module: fs.readFileSync(
    new URL("../../frontend/lib/openmls/vinss_mls_bg.wasm", import.meta.url),
  ),
});

// Same real MLS/Canton transport scenario for local contract simulation and opt-in live ledger.
export async function messagingScenario(ledgers, parties) {
  const conversationId = crypto.randomUUID();
  const factory = new IDBFactory();
  const peers = parties.map((party, i) => ({
    userId: `wallet:${party}`,
    installationId: crypto.randomUUID(),
    credential: new TextEncoder().encode(party),
    role: i === 0 ? "super_admin" : "member",
  }));
  const roster = new Set([parties[0], parties[1]]);
  const partyByInstallation = new Map(
    peers.map((p, i) => [p.installationId, parties[i]]),
  );
  const checkpoint = new IndexedDbOpenMlsCheckpointStore({
    indexedDB: factory,
    crypto: globalThis.crypto,
    dbName: "scenario-mls",
  });
  async function participant(i) {
    const party = parties[i];
    const directory = await AuthenticatedCantonMessagingDirectory.connect(
      ledgers[i],
      {
        localInstallationId: peers[i].installationId,
        async resolvePartyForInstallation(id) {
          assert.ok(partyByInstallation.has(id));
          return partyByInstallation.get(id);
        },
        async recipientsForConversation(id) {
          assert.ok(typeof id === "string");
          return [...roster].filter((p) => p !== party);
        },
        async keyPackageReaders() {
          return parties.filter((p) => p !== party);
        },
      },
    );
    const transport = new CantonMessagingTransport(
      ledgers[i],
      directory,
      async (id) => {
        assert.ok(partyByInstallation.has(id));
        return partyByInstallation.get(id);
      },
    );
    const history = new IndexedDbPlaintextStore(
      JSON.stringify(["test", party, peers[i].installationId]),
      factory,
    );
    const bridge = new BrowserOpenMlsBridge(async () => wasm, checkpoint);
    const provider = new OpenMlsMessagingProvider(
      bridge,
      transport,
      undefined,
      { history, groupStateSender: peers[0].installationId },
    );
    await provider.initialize(peers[i]);
    return { provider, bridge, history, transport };
  }
  let clients = await Promise.all(parties.map((_, i) => participant(i)));
  const cursors = new Array(parties.length);
  async function sync(i) {
    const result = await clients[i].provider.sync(conversationId, cursors[i]);
    cursors[i] = result.nextCursor ?? cursors[i];
    return result.messages;
  }
  const sent = [];
  async function send(i, text) {
    const message = {
      id: crypto.randomUUID(),
      conversationId,
      senderUserId: peers[i].userId,
      senderInstallationId: peers[i].installationId,
      sentAt: Date.now(),
      content: { type: "text", text },
    };
    await clients[i].provider.send(message);
    sent.push(message);
    return message;
  }
  await clients[0].provider.createGroup({
    conversationId,
    title: "Alice, Bob and Charlie",
    creator: peers[0],
  });
  await clients[0].provider.addMembers(conversationId, [peers[1]]);
  assert.equal((await sync(1)).length, 0);
  assert.equal(
    (await clients[1].bridge.getGroupSnapshot(conversationId)).members.length,
    2,
  );
  const ab = await send(0, `VINSS secret Alice to Bob ${crypto.randomUUID()}`);
  assert.deepEqual(await sync(1), [ab]);
  const ba = await send(1, `VINSS secret Bob to Alice ${crypto.randomUUID()}`);
  assert.deepEqual(await sync(0), [ba]);
  assert.equal(
    (await ledgers[2].queryActiveContracts(parties[2])).some(
      (c) => c.createArgument.messageId === ab.id,
    ),
    false,
  );
  console.log("PASS Alice → Bob, Bob → Alice, unrelated Party excluded");

  const offline = await send(0, `VINSS offline Bob ${crypto.randomUUID()}`);
  roster.add(parties[2]);
  await clients[0].provider.addMembers(conversationId, [peers[2]]);
  assert.deepEqual(await sync(1), [offline]);
  await sync(2);
  for (const i of [0, 1, 2])
    assert.equal(
      (await clients[i].bridge.getGroupSnapshot(conversationId)).members.length,
      3,
    );
  for (const i of [0, 1, 2]) {
    const groupMessage = await send(
      i,
      `VINSS group secret from ${i} ${crypto.randomUUID()}`,
    );
    for (const j of [0, 1, 2])
      if (j !== i) assert.deepEqual(await sync(j), [groupMessage]);
  }
  console.log("PASS three-member group, every sender → both other members");

  const previous = await clients[1].history.list(conversationId);
  clients[1] = await participant(1); // fresh bridge and store instance; encrypted checkpoint loaded.
  assert.deepEqual(await clients[1].history.list(conversationId), previous);
  assert.deepEqual(await sync(1), []);
  const afterReload = await send(
    1,
    `VINSS after reload ${crypto.randomUUID()}`,
  );
  assert.deepEqual(await sync(0), [afterReload]);
  assert.deepEqual(await sync(2), [afterReload]);
  const replay = await clients[1].provider.sync(conversationId);
  assert.equal(
    new Set(replay.messages.map((m) => m.id)).size,
    replay.messages.length,
  );
  assert.deepEqual(await clients[1].history.list(conversationId), [
    ...previous,
    afterReload,
  ]);
  console.log(
    "PASS checkpoint + local plaintext reload, send after reload, cached replay",
  );
  for (const message of sent) {
    const contracts = await ledgers[0].queryActiveContracts(parties[0]);
    const contract = contracts.find(
      (c) => c.createArgument.messageId === message.id,
    );
    assert.ok(contract, "EncryptedMessage must exist");
    assert.equal(
      JSON.stringify(contract.createArgument).includes(message.content.text),
      false,
    );
    assert.notEqual(
      contract.createArgument.ciphertextB64,
      Buffer.from(message.content.text).toString("base64"),
    );
  }
  console.log(
    "PASS submitted contracts contain MLS ciphertext, no message plaintext",
  );

  await clients[0].provider.removeMembers(conversationId, [
    peers[2].installationId,
  ]);
  roster.delete(parties[2]);
  await sync(1);
  const removed = await send(0, `VINSS after removal ${crypto.randomUUID()}`);
  assert.deepEqual(await sync(1), [removed]);
  assert.equal(
    (await ledgers[2].queryActiveContracts(parties[2])).some(
      (c) => c.createArgument.messageId === removed.id,
    ),
    false,
  );
  const envelope = (
    await clients[0].transport.fetchCiphertexts(conversationId)
  ).items.find((x) => x.id === removed.id);
  await assert.rejects(() =>
    clients[2].bridge.decryptApplicationMessage({
      conversationId,
      ciphertext: envelope.payload,
    }),
  );
  console.log(
    "PASS core member removal: visibility excluded, newer ciphertext undecryptable",
  );

  for (const client of clients) {
    const now = Date.now();
    await client.transport.publishKeyPackage({
      installationId: peers[clients.indexOf(client)].installationId,
      keyPackage: await client.bridge.createKeyPackage(),
      createdAt: now,
      expiresAt: now + 86400000,
    });
  }
  const delayedRoom = crypto.randomUUID();
  roster.clear();
  roster.add(parties[0]);
  roster.add(parties[1]);
  await clients[0].provider.createGroup({
    conversationId: delayedRoom,
    title: "Delayed first Welcome",
    creator: peers[0],
  });
  await clients[0].provider.addMembers(delayedRoom, [peers[1]]);
  const delayed = {
    id: crypto.randomUUID(),
    conversationId: delayedRoom,
    senderUserId: peers[0].userId,
    senderInstallationId: peers[0].installationId,
    sentAt: Date.now(),
    content: { type: "text", text: "Before Bob opens the room" },
  };
  await clients[0].provider.send(delayed);
  roster.add(parties[2]);
  await clients[0].provider.addMembers(delayedRoom, [peers[2]]);
  assert.deepEqual((await clients[1].provider.sync(delayedRoom)).messages, [
    delayed,
  ]);
  assert.deepEqual((await clients[2].provider.sync(delayedRoom)).messages, []);
  assert.equal(
    (await clients[1].bridge.getGroupSnapshot(delayedRoom)).members.length,
    3,
  );
  console.log(
    "PASS delayed first Welcome, old state/message before later Commit; newcomer cannot see pre-join text",
  );
  return { conversationId, messages: sent.length + 2, members: parties.length };
}
