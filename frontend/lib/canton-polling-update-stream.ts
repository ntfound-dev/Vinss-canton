import type { CantonLedgerClient } from "../../src/canton/ledger-client.js";

import type {
  CantonUpdateBatch,
  CantonUpdateStream,
  CantonUpdateSubscription,
} from "../../src/canton/update-stream.js";

export interface CantonPollingUpdateStreamOptions {
  ledger: CantonLedgerClient;

  intervalMs?: number;
}

export class CantonPollingUpdateStream implements CantonUpdateStream {
  readonly #intervalMs: number;

  constructor(private readonly options: CantonPollingUpdateStreamOptions) {
    this.#intervalMs = Math.max(500, options.intervalMs ?? 1_500);
  }

  async subscribe(input: {
    party: string;

    afterExclusive: bigint;

    onBatch(batch: CantonUpdateBatch): void | Promise<void>;

    onError?(error: Error): void;

    onClose?(): void;
  }): Promise<CantonUpdateSubscription> {
    let closed = false;

    let cursor = input.afterExclusive;

    let timer: ReturnType<typeof setTimeout> | undefined;

    let polling = false;

    const schedule = () => {
      if (closed) {
        return;
      }

      timer = setTimeout(() => {
        void poll();
      }, this.#intervalMs);
    };

    const poll = async () => {
      if (closed || polling) {
        return;
      }

      polling = true;

      try {
        // Capture a safe lower upper-bound first. The subsequent
        // updates query reaches at least this offset.
        const snapshot = await this.options.ledger.queryActiveContractsSnapshot(
          input.party,
        );

        const created = await this.options.ledger.queryCreatedContractsSince(
          input.party,
          cursor,
        );

        const ordered = [...created]
          .filter((contract) => contract.offset > cursor)
          .sort((left, right) =>
            left.offset < right.offset
              ? -1
              : left.offset > right.offset
                ? 1
                : 0,
          );

        if (ordered.length > 0) {
          const next = ordered[ordered.length - 1]!.offset;

          await input.onBatch({
            offset: next,

            createdContracts: ordered,
          });
          cursor = next;
        } else if (snapshot.offset > cursor) {
          // The updates request covered at least snapshot.offset
          // and yielded no created contracts, so it is safe to
          // advance the cursor through that point.
          await input.onBatch({
            offset: snapshot.offset,

            createdContracts: [],
          });
          cursor = snapshot.offset;
        }
      } catch (cause) {
        input.onError?.(toError(cause));
      } finally {
        polling = false;

        schedule();
      }
    };

    // Start quickly after the initial ACS snapshot from live-session.
    timer = setTimeout(() => {
      void poll();
    }, 250);

    return {
      close() {
        closed = true;

        if (timer !== undefined) {
          clearTimeout(timer);

          timer = undefined;
        }
      },
    };
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
