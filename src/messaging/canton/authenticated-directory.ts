import type {
  CantonLedgerClient,
} from "../../canton/ledger-client.js";

import type {
  CantonPartyId,
} from "../../canton/types.js";

import type {
  ConversationId,
  InstallationId,
} from "../types.js";

import type {
  CantonMessagingDirectory,
} from "./directory.js";

export interface CantonDirectoryResolvers {
  localInstallationId:
    InstallationId;

  resolvePartyForInstallation(
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

export class AuthenticatedCantonMessagingDirectory
  implements CantonMessagingDirectory
{
  private constructor(
    private readonly party:
      CantonPartyId,

    private readonly resolvers:
      CantonDirectoryResolvers,
  ) {}

  static async connect(
    ledger:
      CantonLedgerClient,

    resolvers:
      CantonDirectoryResolvers,
  ): Promise<
    AuthenticatedCantonMessagingDirectory
  > {
    const identity =
      await ledger
        .getAuthenticatedIdentity();

    const party =
      identity.primaryParty;

    if (
      !identity.canActAs.includes(
        party,
      )
    ) {
      throw new Error(
        `Authenticated Canton user cannot act as primary party: ${party}`,
      );
    }

    return new AuthenticatedCantonMessagingDirectory(
      party,
      resolvers,
    );
  }

  activeParty():
    CantonPartyId {
    return this.party;
  }

  async partyForInstallation(
    installationId:
      InstallationId,
  ): Promise<CantonPartyId> {
    if (
      installationId ===
      this.resolvers
        .localInstallationId
    ) {
      return this.party;
    }

    const resolved =
      await this.resolvers
        .resolvePartyForInstallation(
          installationId,
        );

    if (!resolved) {
      throw new Error(
        `No Canton party binding for installation: ${installationId}`,
      );
    }

    return resolved;
  }

  recipientsForConversation(
    conversationId:
      ConversationId,
  ): Promise<
    readonly CantonPartyId[]
  > {
    return this.resolvers
      .recipientsForConversation(
        conversationId,
      );
  }

  keyPackageReaders(): Promise<
    readonly CantonPartyId[]
  > {
    return this.resolvers
      .keyPackageReaders();
  }
}
