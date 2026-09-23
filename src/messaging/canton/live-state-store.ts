import type {
  CantonPartyId,
} from "../../canton/types.js";

import type {
  ConversationId,
  InstallationId,
} from "../types.js";

export interface CantonLiveStateStore {
  loadLedgerOffset(
    party: CantonPartyId,
    installationId: InstallationId,
  ): Promise<bigint | undefined>;

  saveLedgerOffset(
    party: CantonPartyId,
    installationId: InstallationId,
    offset: bigint,
  ): Promise<void>;

  loadMessageCursor(
    installationId: InstallationId,
    conversationId: ConversationId,
  ): Promise<string | undefined>;

  saveMessageCursor(
    installationId: InstallationId,
    conversationId: ConversationId,
    cursor: string,
  ): Promise<void>;
}
