import type {
  CantonPartyId,
} from "../../canton/types.js";

import type {
  ConversationId,
  InstallationId,
} from "../types.js";

export interface CantonMessagingDirectory {
  activeParty():
    CantonPartyId;

  partyForInstallation(
    installationId:
      InstallationId,
  ): Promise<CantonPartyId>;

  recipientsForConversation(
    conversationId:
      ConversationId,
  ): Promise<
    readonly CantonPartyId[]
  >;

  keyPackageReaders(): Promise<
    readonly CantonPartyId[]
  >;
}
