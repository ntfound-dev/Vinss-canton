import { it, expect } from "vitest";
import { BrowserCantonLiveStateStore } from "../src/messaging/canton/browser-live-state-store.js";
it("migrates only legacy room cursor, keeps new room ledger offset independent", async () => {
  const values = new Map<string, string>(),
    storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    };
  const old = new BrowserCantonLiveStateStore(storage);
  await old.saveLedgerOffset("Alice", "install", 999n);
  await old.saveMessageCursor("install", "room-a", "c:42");
  const next = new BrowserCantonLiveStateStore(
    storage,
    "vinss-canton:devnet:room-a",
    "vinss-canton",
  );
  expect(await next.loadLedgerOffset("Alice", "install")).toBeUndefined();
  expect(await next.loadMessageCursor("install", "room-a")).toBe("c:42");
  await next.saveMessageCursor("install", "room-a", "c:43");
  expect(await next.loadMessageCursor("install", "room-a")).toBe("c:43");
  expect(await old.loadMessageCursor("install", "room-a")).toBe("c:42");
  expect(
    await new BrowserCantonLiveStateStore(
      storage,
      "vinss-canton:devnet:room-b",
      "vinss-canton",
    ).loadMessageCursor("install", "room-b"),
  ).toBeUndefined();
});
