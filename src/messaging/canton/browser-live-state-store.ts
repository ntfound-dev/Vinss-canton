import type {
  CantonPartyId,
} from "../../canton/types.js";

import type {
  ConversationId,
  InstallationId,
} from "../types.js";

import type {
  CantonLiveStateStore,
} from "./live-state-store.js";

export interface BrowserKeyValueStorage {
  getItem(
    key: string,
  ): string | null;

  setItem(
    key: string,
    value: string,
  ): void;

  removeItem(
    key: string,
  ): void;
}

export class BrowserCantonLiveStateStore
  implements CantonLiveStateStore
{
  constructor(
    private readonly storage:
      BrowserKeyValueStorage,

    private readonly namespace =
      "vinss-canton",
  ) {}

  async loadLedgerOffset(
    party: CantonPartyId,
    installationId:
      InstallationId,
  ): Promise<
    bigint | undefined
  > {
    const value =
      this.storage.getItem(
        ledgerKey(
          this.namespace,
          party,
          installationId,
        ),
      );

    if (value === null) {
      return undefined;
    }

    if (!/^\d+$/.test(value)) {
      throw new Error(
        "Invalid persisted Canton ledger offset",
      );
    }

    return BigInt(value);
  }

  async saveLedgerOffset(
    party: CantonPartyId,
    installationId:
      InstallationId,
    offset: bigint,
  ): Promise<void> {
    if (offset < 0n) {
      throw new Error(
        "Canton ledger offset cannot be negative",
      );
    }

    this.storage.setItem(
      ledgerKey(
        this.namespace,
        party,
        installationId,
      ),
      offset.toString(),
    );
  }

  async loadMessageCursor(
    installationId:
      InstallationId,
    conversationId:
      ConversationId,
  ): Promise<
    string | undefined
  > {
    return (
      this.storage.getItem(
        messageKey(
          this.namespace,
          installationId,
          conversationId,
        ),
      ) ?? undefined
    );
  }

  async saveMessageCursor(
    installationId:
      InstallationId,
    conversationId:
      ConversationId,
    cursor: string,
  ): Promise<void> {
    this.storage.setItem(
      messageKey(
        this.namespace,
        installationId,
        conversationId,
      ),
      cursor,
    );
  }
}

function ledgerKey(
  namespace: string,
  party: CantonPartyId,
  installationId:
    InstallationId,
): string {
  return [
    namespace,
    "ledger",
    encodeURIComponent(party),
    encodeURIComponent(
      installationId,
    ),
  ].join(":");
}

function messageKey(
  namespace: string,
  installationId:
    InstallationId,
  conversationId:
    ConversationId,
): string {
  return [
    namespace,
    "message",
    encodeURIComponent(
      installationId,
    ),
    encodeURIComponent(
      conversationId,
    ),
  ].join(":");
}
