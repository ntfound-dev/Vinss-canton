import type {
  CantonLedgerClient,
} from "./ledger-client.js";

import type {
  CantonFulfillmentProvider,
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
  type CantonDealTemplateName,
} from "./deal-templates.js";

export class HttpCantonOfferProvider
  implements
    CantonOfferProvider,
    CantonFulfillmentProvider
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

    const fulfiller =
      terms.fulfiller ??
      terms.seller;

    const reviewer =
      terms.reviewer ??
      terms.buyer;

    if (
      fulfiller !==
        terms.seller &&
      fulfiller !==
        terms.buyer
    ) {
      throw new Error(
        "VINSS fulfiller must be one of the deal parties",
      );
    }

    if (
      reviewer !==
        terms.seller &&
      reviewer !==
        terms.buyer
    ) {
      throw new Error(
        "VINSS reviewer must be one of the deal parties",
      );
    }

    if (
      fulfiller ===
      reviewer
    ) {
      throw new Error(
        "VINSS fulfiller and reviewer must be different parties",
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
              fulfiller,
              reviewer,
              createdAt,
            },
          },
        ],
      });

    return this
      .findLatestContractId(
        actingParty,
        "DealProposal",
        terms.dealId,
        "VINSS DealProposal was not found after creation",
      );
  }

  async acceptProposal(
    actingParty:
      CantonPartyId,

    proposalContractId:
      CantonContractId,
  ): Promise<DealAgreement> {
    const proposal =
      await this.requireContract(
        actingParty,
        proposalContractId,
        "DealProposal",
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
      await this.requireContract(
        actingParty,
        proposalContractId,
        "DealProposal",
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

  async submitFulfillment(
    actingParty:
      CantonPartyId,

    agreementContractId:
      CantonContractId,

    fulfillmentHash:
      string,
  ): Promise<CantonContractId> {
    const cleanHash =
      requireHash(
        fulfillmentHash,
        "fulfillment",
      );

    const agreement =
      await this.requireContract(
        actingParty,
        agreementContractId,
        "DealAgreement",
      );

    const dealId =
      readString(
        agreement.createArgument,
        "dealId",
      );

    const fulfiller =
      readRole(
        agreement.createArgument,
        "fulfiller",
        "seller",
      );

    if (
      actingParty !==
      fulfiller
    ) {
      throw new Error(
        "Only the VINSS fulfiller can submit fulfillment",
      );
    }

    await this.ledger
      .submitExercise({
        actingParty,

        commandId:
          `deal-fulfillment-${crypto.randomUUID()}`,

        templateId:
          cantonDealTemplates
            .agreement,

        contractId:
          agreementContractId,

        choice:
          "SubmitFulfillment",

        choiceArgument: {
          fulfillmentHash:
            cleanHash,
        },
      });

    return this
      .findLatestContractId(
        actingParty,
        "DealFulfillment",
        dealId,
        "VINSS DealFulfillment was not found after submission",
      );
  }

  async approveFulfillment(
    actingParty:
      CantonPartyId,

    fulfillmentContractId:
      CantonContractId,
  ): Promise<CantonContractId> {
    const fulfillment =
      await this.requireContract(
        actingParty,
        fulfillmentContractId,
        "DealFulfillment",
      );

    const dealId =
      readString(
        fulfillment.createArgument,
        "dealId",
      );

    const reviewer =
      readRole(
        fulfillment.createArgument,
        "reviewer",
        "buyer",
      );

    if (
      actingParty !==
      reviewer
    ) {
      throw new Error(
        "Only the VINSS reviewer can approve fulfillment",
      );
    }

    await this.ledger
      .submitExercise({
        actingParty,

        commandId:
          `deal-fulfillment-approve-${crypto.randomUUID()}`,

        templateId:
          cantonDealTemplates
            .fulfillment,

        contractId:
          fulfillmentContractId,

        choice:
          "Approve",

        choiceArgument: {},
      });

    return this
      .findLatestContractId(
        actingParty,
        "FulfillmentApproval",
        dealId,
        "VINSS FulfillmentApproval was not found after approval",
      );
  }

  async requestRevision(
    actingParty:
      CantonPartyId,

    fulfillmentContractId:
      CantonContractId,

    reviewHash:
      string,
  ): Promise<CantonContractId> {
    const cleanHash =
      requireHash(
        reviewHash,
        "review",
      );

    const fulfillment =
      await this.requireContract(
        actingParty,
        fulfillmentContractId,
        "DealFulfillment",
      );

    const dealId =
      readString(
        fulfillment.createArgument,
        "dealId",
      );

    const reviewer =
      readRole(
        fulfillment.createArgument,
        "reviewer",
        "buyer",
      );

    if (
      actingParty !==
      reviewer
    ) {
      throw new Error(
        "Only the VINSS reviewer can request a revision",
      );
    }

    await this.ledger
      .submitExercise({
        actingParty,

        commandId:
          `deal-fulfillment-revision-${crypto.randomUUID()}`,

        templateId:
          cantonDealTemplates
            .fulfillment,

        contractId:
          fulfillmentContractId,

        choice:
          "RequestRevision",

        choiceArgument: {
          reviewHash:
            cleanHash,
        },
      });

    return this
      .findLatestContractId(
        actingParty,
        "DealRevisionRequest",
        dealId,
        "VINSS DealRevisionRequest was not found after review",
      );
  }

  async submitRevision(
    actingParty:
      CantonPartyId,

    revisionRequestContractId:
      CantonContractId,

    fulfillmentHash:
      string,
  ): Promise<CantonContractId> {
    const cleanHash =
      requireHash(
        fulfillmentHash,
        "fulfillment",
      );

    const revision =
      await this.requireContract(
        actingParty,
        revisionRequestContractId,
        "DealRevisionRequest",
      );

    const dealId =
      readString(
        revision.createArgument,
        "dealId",
      );

    const fulfiller =
      readRole(
        revision.createArgument,
        "fulfiller",
        "seller",
      );

    if (
      actingParty !==
      fulfiller
    ) {
      throw new Error(
        "Only the VINSS fulfiller can submit a revision",
      );
    }

    await this.ledger
      .submitExercise({
        actingParty,

        commandId:
          `deal-fulfillment-resubmit-${crypto.randomUUID()}`,

        templateId:
          cantonDealTemplates
            .revisionRequest,

        contractId:
          revisionRequestContractId,

        choice:
          "SubmitRevision",

        choiceArgument: {
          fulfillmentHash:
            cleanHash,
        },
      });

    return this
      .findLatestContractId(
        actingParty,
        "DealFulfillment",
        dealId,
        "VINSS DealFulfillment was not found after revision",
      );
  }

  private async requireContract(
    party:
      CantonPartyId,

    contractId:
      CantonContractId,

    templateName:
      CantonDealTemplateName,
  ) {
    const contracts =
      await this.ledger
        .queryActiveContracts(
          party,
        );

    const contract =
      contracts.find(
        (candidate) =>
          candidate.contractId ===
            contractId &&
          isCantonDealTemplate(
            candidate.templateId,
            templateName,
          ),
      );

    if (!contract) {
      throw new Error(
        `VINSS ${templateName} not found: ${contractId}`,
      );
    }

    return contract;
  }

  private async findLatestContractId(
    party:
      CantonPartyId,

    templateName:
      CantonDealTemplateName,

    dealId:
      string,

    missingMessage:
      string,
  ): Promise<CantonContractId> {
    const contracts =
      await this.ledger
        .queryActiveContracts(
          party,
        );

    const contract =
      contracts
        .filter(
          (candidate) =>
            isCantonDealTemplate(
              candidate.templateId,
              templateName,
            ) &&
            readString(
              candidate.createArgument,
              "dealId",
            ) ===
              dealId,
        )
        .at(-1);

    if (!contract) {
      throw new Error(
        missingMessage,
      );
    }

    return contract.contractId;
  }
}

function readTerms(
  value:
    Record<string, unknown>,
): DealTerms {
  const seller =
    readString(
      value,
      "seller",
    );

  const buyer =
    readString(
      value,
      "buyer",
    );

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

    seller,

    buyer,

    fulfiller:
      readOptionalString(
        value,
        "fulfiller",
      ) ??
      seller,

    reviewer:
      readOptionalString(
        value,
        "reviewer",
      ) ??
      buyer,

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

function readRole(
  value:
    Record<string, unknown>,
  key: string,
  fallbackKey:
    string,
): string {
  return (
    readOptionalString(
      value,
      key,
    ) ??
    readString(
      value,
      fallbackKey,
    )
  );
}

function readOptionalString(
  value:
    Record<string, unknown>,
  key: string,
): string | undefined {
  const result =
    value[key];

  return typeof result ===
    "string"
    ? result
    : undefined;
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

function requireHash(
  value: string,
  label: string,
): string {
  const clean =
    value.trim();

  if (!clean) {
    throw new Error(
      `VINSS ${label} hash is required`,
    );
  }

  return clean;
}
