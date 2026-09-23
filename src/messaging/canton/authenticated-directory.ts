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

import {
  isCantonTemplate,
} from "./templates.js";

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
    private readonly ledger:
      CantonLedgerClient,

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
      ledger,
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

    const contracts =
      await this.ledger
        .queryActiveContracts(
          this.party,
        );

    const verifiedOwners =
      new Set<
        CantonPartyId
      >();

    for (
      const contract
      of contracts
    ) {
      if (
        !isCantonTemplate(
          contract.templateId,
          "KeyPackageOffer",
        )
      ) {
        continue;
      }

      const args =
        contract.createArgument;

      if (
        readString(
          args,
          "requester",
        ) !== this.party ||
        readString(
          args,
          "installationId",
        ) !== installationId
      ) {
        continue;
      }

      const expiresAt =
        Date.parse(
          readString(
            args,
            "expiresAt",
          ),
        );

      if (
        !Number.isFinite(
          expiresAt,
        ) ||
        expiresAt <=
          Date.now()
      ) {
        continue;
      }

      verifiedOwners.add(
        readString(
          args,
          "owner",
        ),
      );
    }

    if (
      verifiedOwners.size ===
      0
    ) {
      throw new Error(
        `No verified Canton party binding for installation: ${installationId}`,
      );
    }

    if (
      verifiedOwners.size >
      1
    ) {
      throw new Error(
        `Ambiguous Canton party binding for installation: ${installationId}`,
      );
    }

    const verified =
      [...verifiedOwners][0]!;

    if (
      verified !== resolved
    ) {
      throw new Error(
        `Canton party binding mismatch for installation: ${installationId}`,
      );
    }

    return verified;
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


function readString(
  value:
    Record<string, unknown>,
  key: string,
): string {
  const result =
    value[key];

  if (
    typeof result !==
      "string"
  ) {
    throw new Error(
      `Invalid Canton directory field: ${key}`,
    );
  }

  return result;
}
