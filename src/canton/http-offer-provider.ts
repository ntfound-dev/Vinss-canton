import type {
  CantonLedgerClient,
} from "./ledger-client.js";

import type {
  CantonOfferProvider,
} from "./provider.js";

import type {
  CantonContractId,
  CantonPartyId,
  DealAgreement,
  DealTerms,
} from "./types.js";

import {
  cantonDealTemplates,
  isCantonDealTemplate,
} from "./deal-templates.js";

export class HttpCantonOfferProvider
  implements CantonOfferProvider
{
  constructor(
    private readonly ledger:
      CantonLedgerClient,
  ) {}

  async createProposal(
    actingParty:
      CantonPartyId,

    terms:
      DealTerms,
  ): Promise<CantonContractId> {
    if (
      actingParty !==
      terms.seller
    ) {
      throw new Error(
        "Only the seller can create this VINSS proposal",
      );
    }

    const createdAt =
      new Date()
        .toISOString();

    await this.ledger
      .submitCreates({
        actingParty,

        commandId:
          `deal-proposal-${crypto.randomUUID()}`,

        creates: [
          {
            templateId:
              cantonDealTemplates
                .proposal,

            createArguments: {
              ...terms,
              createdAt,
            },
          },
        ],
      });

    const contracts =
      await this.ledger
        .queryActiveContracts(
          actingParty,
        );

    const proposal =
      contracts
        .filter(
          (contract) =>
            isCantonDealTemplate(
              contract.templateId,
              "DealProposal",
            ) &&
            readString(
              contract
                .createArgument,
              "dealId",
            ) ===
              terms.dealId,
        )
        .at(-1);

    if (!proposal) {
      throw new Error(
        "VINSS DealProposal was not found after creation",
      );
    }

    return proposal.contractId;
  }

  async acceptProposal(
    actingParty:
      CantonPartyId,

    proposalContractId:
      CantonContractId,
  ): Promise<DealAgreement> {
    const proposal =
      await this.requireProposal(
        actingParty,
        proposalContractId,
      );

    const terms =
      readTerms(
        proposal.createArgument,
      );

    if (
      actingParty !==
      terms.buyer
    ) {
      throw new Error(
        "Only the buyer can accept this VINSS proposal",
      );
    }

    await this.ledger
      .submitExercise({
        actingParty,

        commandId:
          `deal-accept-${crypto.randomUUID()}`,

        templateId:
          cantonDealTemplates
            .proposal,

        contractId:
          proposalContractId,

        choice:
          "Accept",

        choiceArgument: {},
      });

    const contracts =
      await this.ledger
        .queryActiveContracts(
          actingParty,
        );

    const agreement =
      contracts
        .filter(
          (contract) =>
            isCantonDealTemplate(
              contract.templateId,
              "DealAgreement",
            ) &&
            readString(
              contract
                .createArgument,
              "dealId",
            ) ===
              terms.dealId,
        )
        .at(-1);

    if (!agreement) {
      throw new Error(
        "VINSS DealAgreement was not found after acceptance",
      );
    }

    return {
      contractId:
        agreement.contractId,

      terms:
        readTerms(
          agreement
            .createArgument,
        ),

      acceptedAt:
        readString(
          agreement
            .createArgument,
          "acceptedAt",
        ),
    };
  }

  async rejectProposal(
    actingParty:
      CantonPartyId,

    proposalContractId:
      CantonContractId,
  ): Promise<void> {
    const proposal =
      await this.requireProposal(
        actingParty,
        proposalContractId,
      );

    const buyer =
      readString(
        proposal
          .createArgument,
        "buyer",
      );

    if (
      actingParty !== buyer
    ) {
      throw new Error(
        "Only the buyer can reject this VINSS proposal",
      );
    }

    await this.ledger
      .submitExercise({
        actingParty,

        commandId:
          `deal-reject-${crypto.randomUUID()}`,

        templateId:
          cantonDealTemplates
            .proposal,

        contractId:
          proposalContractId,

        choice:
          "Reject",

        choiceArgument: {},
      });
  }

  private async requireProposal(
    party:
      CantonPartyId,

    contractId:
      CantonContractId,
  ) {
    const contracts =
      await this.ledger
        .queryActiveContracts(
          party,
        );

    const proposal =
      contracts.find(
        (contract) =>
          contract.contractId ===
            contractId &&
          isCantonDealTemplate(
            contract.templateId,
            "DealProposal",
          ),
      );

    if (!proposal) {
      throw new Error(
        `VINSS DealProposal not found: ${contractId}`,
      );
    }

    return proposal;
  }
}

function readTerms(
  value:
    Record<string, unknown>,
): DealTerms {
  return {
    dealId:
      readString(
        value,
        "dealId",
      ),

    conversationId:
      readString(
        value,
        "conversationId",
      ),

    seller:
      readString(
        value,
        "seller",
      ),

    buyer:
      readString(
        value,
        "buyer",
      ),

    termsHash:
      readString(
        value,
        "termsHash",
      ),

    amount:
      readString(
        value,
        "amount",
      ),

    instrumentId:
      readString(
        value,
        "instrumentId",
      ),

    expiresAt:
      readString(
        value,
        "expiresAt",
      ),
  };
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
      `Invalid Canton deal field: ${key}`,
    );
  }

  return result;
}
