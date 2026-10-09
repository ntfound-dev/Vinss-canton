import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PrepareExecuteParams } from "@canton-network/dapp-sdk";

const account = { authenticated: true, userId: "alice-user", partyId: "alice::123", parties: ["alice::123", "alice-other::123"], ccAdmin: "DSO::live-network" };
const params = { commands: [{ CreateCommand: { templateId: "#vinss:Deal:DealProposal", createArguments: { client: account.partyId } } }], actAs: [account.partyId] } as PrepareExecuteParams;
let operations: Record<string, unknown>[];
beforeEach(() => {
  vi.resetModules(); operations = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, init?: RequestInit) => {
    if (!init?.body) return Response.json(init?.method === "DELETE" ? { disconnected: true } : account);
    const value = JSON.parse(String(init.body)); operations.push(value);
    if (value.operation === "prepare") return Response.json({ ticket: "encrypted-approval" });
    if (value.operation === "execute") return Response.json({ updateId: "actual-ledger-update", completionOffset: 42 });
    return Response.json(account);
  }));
});
afterEach(() => vi.unstubAllGlobals());
it("requires explicit UI approval, preserves command ID and accepts only a complete ledger receipt", async () => {
  const { devNetWallet, installDevNetApproval } = await import("../lib/devnet-wallet");
  await expect(devNetWallet.prepareExecuteAndWait(params)).rejects.toThrow("sign in before approving");
  const approve = vi.fn(async () => true), remove = installDevNetApproval(approve);
  const result = await devNetWallet.prepareExecuteAndWait(params);
  expect(result.tx.payload).toEqual({ updateId: "actual-ledger-update", completionOffset: 42 });
  expect(approve).toHaveBeenCalledOnce();
  expect(operations[0].operation).toBe("prepare"); expect(operations[1].operation).toBe("execute");
  expect(operations[1].params).toEqual(operations[0].params);
  expect(operations[0].params).toHaveProperty("commandId"); remove();
});
it("does not submit when the user rejects the approval dialog", async () => {
  const { devNetWallet, installDevNetApproval } = await import("../lib/devnet-wallet");
  installDevNetApproval(async () => false);
  await expect(devNetWallet.prepareExecuteAndWait(params)).rejects.toThrow("No submission was sent");
  expect(operations.map(o => o.operation)).toEqual(["prepare"]);
});
it("rejects incomplete receipts instead of claiming a successful transaction", async () => {
  const { devNetWallet, installDevNetApproval } = await import("../lib/devnet-wallet");
  installDevNetApproval(async () => true);
  vi.stubGlobal("fetch", vi.fn(async (_url, init?: RequestInit) => {
    const value = init?.body ? JSON.parse(String(init.body)) : {};
    return Response.json(value.operation === "execute" ? { updateId: "missing-offset" } : value.operation === "prepare" ? { ticket: "ticket" } : account);
  }));
  await expect(devNetWallet.prepareExecuteAndWait(params)).rejects.toThrow("no complete receipt");
});
it("restores a verified Party, changes only via the server, and clears it on disconnect", async () => {
  const { devNetWallet, selectDevNetParty } = await import("../lib/devnet-wallet");
  expect((await devNetWallet.listAccounts())[0].partyId).toBe(account.partyId);
  const listener = vi.fn(); await devNetWallet.onAccountsChanged(listener);
  await selectDevNetParty(account.partyId); expect(operations[0]).toEqual({ operation: "select", partyId: account.partyId });
  expect(listener).toHaveBeenCalled(); await devNetWallet.disconnect(); expect(devNetWallet.availableParties()).toEqual([]);
});
it("forwards CC registry calls through the server but never sends the node token to other registries", async () => {
  const { devNetRegistryFetch } = await import("../lib/devnet-wallet");
  await devNetRegistryFetch("https://validator-api-http.validator.hackcanton-01.devnet.naas.noders.services/api/validator/v0/scan-proxy/registry/allocation-instruction/v1/allocation-factory", { method: "POST", body: "{}" });
  expect(operations[0].operation).toBe("registry");
  await devNetRegistryFetch("https://api.utilities.digitalasset-dev.com/registry", { method: "POST", body: "{}" });
  expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toBe("https://api.utilities.digitalasset-dev.com/registry");
});
