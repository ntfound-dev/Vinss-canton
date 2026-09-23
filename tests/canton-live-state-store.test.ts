import {
  describe,
  expect,
  it,
} from "vitest";

import {
  BrowserCantonLiveStateStore,
} from "../src/messaging/canton/browser-live-state-store.js";

class MemoryStorage {
  readonly values =
    new Map<
      string,
      string
    >();

  getItem(
    key: string,
  ): string | null {
    return (
      this.values.get(key) ??
      null
    );
  }

  setItem(
    key: string,
    value: string,
  ): void {
    this.values.set(
      key,
      value,
    );
  }

  removeItem(
    key: string,
  ): void {
    this.values.delete(key);
  }
}

describe(
  "Canton browser live state",
  () => {
    it(
      "persists ledger offsets and message cursors",
      async () => {
        const store =
          new BrowserCantonLiveStateStore(
            new MemoryStorage(),
          );

        await store
          .saveLedgerOffset(
            "Alice::party",
            "alice-phone",
            42n,
          );

        await store
          .saveMessageCursor(
            "alice-phone",
            "deal-1",
            "c:40",
          );

        await expect(
          store.loadLedgerOffset(
            "Alice::party",
            "alice-phone",
          ),
        ).resolves.toBe(42n);

        await expect(
          store.loadMessageCursor(
            "alice-phone",
            "deal-1",
          ),
        ).resolves.toBe(
          "c:40",
        );
      },
    );
  },
);
