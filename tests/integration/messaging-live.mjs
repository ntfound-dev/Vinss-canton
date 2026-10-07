import assert from "node:assert/strict";
import { HttpCantonLedgerClient } from "../../dist/canton/http-ledger-client.js";
import { messagingScenario } from "./messaging-scenario.mjs";
if (process.env.VINSS_RUN_LIVE_MESSAGING !== "1")
  throw new Error(
    "Live test creates real messaging contracts. Set VINSS_RUN_LIVE_MESSAGING=1 after configuring your three users locally.",
  );
const baseUrl = process.env.CANTON_BASE_URL;
assert.ok(baseUrl, "CANTON_BASE_URL is required; no localhost fallback");
const clients = [];
const parties = [];
for (const name of ["ALICE", "BOB", "CHARLIE"]) {
  const userId = process.env[`CANTON_${name}_USER_ID`],
    token = process.env[`CANTON_${name}_ACCESS_TOKEN`];
  assert.ok(
    userId && token,
    `Set CANTON_${name}_USER_ID and CANTON_${name}_ACCESS_TOKEN locally`,
  );
  const client = new HttpCantonLedgerClient({
    baseUrl,
    userId,
    getAccessToken: async () => token,
  });
  const identity = await client.getAuthenticatedIdentity();
  assert.ok(
    identity.canActAs.includes(identity.primaryParty),
    `${name} must act as its primary Party`,
  );
  assert.equal(
    identity.canActAs.length,
    1,
    `${name} needs an isolated user with one actAs Party`,
  );
  assert.equal(
    identity.canReadAs.some((p) => p !== identity.primaryParty),
    false,
    `${name} must not readAs other Parties`,
  );
  clients.push(client);
  parties.push(identity.primaryParty);
}
assert.equal(new Set(parties).size, 3, "Use three distinct Parties");
console.log("LIVE CANTON + REAL OPENMLS — creates test contracts, no payments");
console.log(await messagingScenario(clients, parties));
