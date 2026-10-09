import { it, expect, vi, afterEach } from "vitest";
import { CantonPollingUpdateStream } from "../frontend/lib/canton-polling-update-stream";
import type { CantonLedgerClient, CantonCreatedContract } from "../src/canton/ledger-client.js";
afterEach(() => vi.useRealTimers());
it("retries the same offset after processing fails; advances only after success", async () => {
  vi.useFakeTimers();
  const queries: bigint[] = [];
  const contract = {
    contractId: "c",
    templateId: "pkg",
    offset: 10n,
    createArgument: {},
  };
  const ledger = {
    queryActiveContractsSnapshot: async () => ({
      offset: 10n,
      contracts: [contract],
    }),
    queryCreatedContractsSince: async (_party: string, offset: bigint) => {
      queries.push(offset);
      return offset < 10n ? [contract] : [];
    },
  } as unknown as CantonLedgerClient;
  const onBatch = vi
      .fn()
      .mockRejectedValueOnce(new Error("local storage temporarily unavailable"))
      .mockResolvedValue(undefined),
    onError = vi.fn();
  const subscription = await new CantonPollingUpdateStream({
    ledger,
    intervalMs: 500,
  }).subscribe({ party: "Alice", afterExclusive: 0n, onBatch, onError });
  await vi.advanceTimersByTimeAsync(250);
  expect(onError).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(500);
  expect(queries).toEqual([0n, 0n]);
  expect(onBatch).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(500);
  expect(queries).toEqual([0n, 0n, 10n]);
  subscription.close();
});

it.each(["result", "error"])("suppresses a late poll %s after the subscription closes", async outcome => {
  vi.useFakeTimers();
  let resolve!: (value: readonly CantonCreatedContract[]) => void;
  let reject!: (error: Error) => void;
  const pending = new Promise<readonly CantonCreatedContract[]>((yes, no) => { resolve = yes; reject = no; });
  const query = vi.fn(() => pending);
  const ledger = {
    queryActiveContractsSnapshot: async () => ({ offset: 10n, contracts: [] }),
    queryCreatedContractsSince: query,
  } as unknown as CantonLedgerClient;
  const onBatch = vi.fn(), onError = vi.fn();
  const subscription = await new CantonPollingUpdateStream({ ledger, intervalMs: 500 })
    .subscribe({ party: "Alice", afterExclusive: 0n, onBatch, onError });
  await vi.advanceTimersByTimeAsync(250);
  expect(query).toHaveBeenCalledTimes(1);
  subscription.close();
  if (outcome === "error") reject(new Error("late network error"));
  else resolve([{ contractId: "late", templateId: "pkg", offset: 10n, createArgument: {} }]);
  await vi.advanceTimersByTimeAsync(1000);
  expect(onBatch).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
  expect(query).toHaveBeenCalledTimes(1);
});
