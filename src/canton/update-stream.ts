import type {
  CantonCreatedContract,
} from "./ledger-client.js";

import type {
  CantonPartyId,
} from "./types.js";

export interface CantonUpdateBatch {
  offset: bigint;

  createdContracts:
    readonly CantonCreatedContract[];
}

export interface CantonUpdateSubscription {
  close(): void;
}

export interface CantonUpdateStream {
  subscribe(input: {
    party: CantonPartyId;

    afterExclusive:
      bigint;

    onBatch(
      batch:
        CantonUpdateBatch,
    ):
      | void
      | Promise<void>;

    onError?(
      error: Error,
    ): void;

    onClose?(): void;
  }): Promise<
    CantonUpdateSubscription
  >;
}
