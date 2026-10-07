import assert from "node:assert/strict";
import { messagingScenario } from "./messaging-scenario.mjs";
// Only ledger storage/visibility is simulated. MLS WASM and Canton transport are production code.
const parties = ["Alice::local", "Bob::local", "Charlie::local"];
const records = [];
let offset = 0n;
const visible = (c, p) =>
  [
    c.createArgument.sender,
    c.createArgument.owner,
    c.createArgument.requester,
    c.createArgument.recipient,
    ...(c.createArgument.recipients ?? []),
  ].includes(p);
const clients = parties.map((party) => ({
  async getAuthenticatedIdentity() {
    return {
      userId: `wallet:${party}`,
      primaryParty: party,
      canActAs: [party],
      canReadAs: [party],
    };
  },
  async submitCreates(input) {
    assert.equal(input.actingParty, party);
    for (const c of input.creates) {
      assert.equal(
        c.createArguments.sender ??
          c.createArguments.owner ??
          c.createArguments.requester,
        party,
      );
      records.push({
        contractId: crypto.randomUUID(),
        templateId: c.templateId,
        offset: ++offset,
        createArgument: structuredClone(c.createArguments),
      });
    }
    return { updateId: crypto.randomUUID(), completionOffset: offset };
  },
  async submitExercise() {
    throw new Error("No business choices in messaging test");
  },
  async queryActiveContracts(p) {
    assert.equal(p, party);
    return records.filter((c) => visible(c, p));
  },
  async queryActiveContractsSnapshot(p) {
    return { offset, contracts: await this.queryActiveContracts(p) };
  },
  async queryCreatedContractsSince(p, after) {
    return (await this.queryActiveContracts(p)).filter((c) => c.offset > after);
  },
}));
console.log(
  "LOCAL LEDGER SIMULATION + REAL OPENMLS WASM — no live Canton claims",
);
console.log(await messagingScenario(clients, parties));
