import type {
  CantonLedgerClient,
} from "./ledger-client.js";

import type {
  CantonChoiceContext,
  CantonDealProvider,
} from "./provider.js";

import type {
  CantonContractId,
  CantonPartyId,
  DealAgreement,
  DealTerms,
  SettlementReceipt,
} from "./types.js";

import {
  cantonDealTemplates,
  isCantonDealTemplate,
  type CantonDealTemplateName,
} from "./deal-templates.js";

export class HttpCantonOfferProvider
  implements
    CantonDealProvider
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

    if (
      terms.instrumentAdmin !==
        undefined &&
      (terms.instrumentAdmin ===
        terms.seller ||
        terms.instrumentAdmin ===
          terms.buyer)
    ) {
      throw new Error(
        "VINSS instrumentAdmin must be independent of the deal parties",
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
              instrumentAdmin:
                terms
                  .instrumentAdmin ??
                null,
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

  async fundEscrow(
    actingParty:
      CantonPartyId,

    agreementContractId:
      CantonContractId,

    allocationContractId:
      CantonContractId,
  ): Promise<CantonContractId> {
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

    const instrumentAdmin =
      readOptionalString(
        agreement.createArgument,
        "instrumentAdmin",
      );

    if (
      instrumentAdmin ===
      undefined
    ) {
      throw new Error(
        "This VINSS deal does not use Canton escrow",
      );
    }

    const reviewer =
      readRole(
        agreement.createArgument,
        "reviewer",
        "buyer",
      );

    if (
      actingParty !==
      reviewer
    ) {
      throw new Error(
        "Only the VINSS reviewer (payer) can fund the escrow",
      );
    }

    // FundEscrow itself re-validates the Allocation (registry, dealId,
    // sender, receiver, executor) on-ledger; this call only has to route
    // to the right choice, not repeat that validation client-side.
    await this.ledger
      .submitExercise({
        actingParty,

        commandId:
          `deal-escrow-fund-${crypto.randomUUID()}`,

        templateId:
          cantonDealTemplates
            .agreement,

        contractId:
          agreementContractId,

        choice:
          "FundEscrow",

        choiceArgument: {
          allocationCid:
            allocationContractId,
        },
      });

    return this
      .findLatestContractId(
        actingParty,
        "DealEscrow",
        dealId,
        "VINSS DealEscrow was not found after funding",
      );
  }

  async submitFulfillment(
    actingParty:
      CantonPartyId,

    sourceContractId:
      CantonContractId,

    fulfillmentHash:
      string,
  ): Promise<CantonContractId> {
    const cleanHash =
      requireHash(
        fulfillmentHash,
        "fulfillment",
      );

    const { contract: source, templateName } =
      await this.requireContractOf(
        actingParty,
        sourceContractId,
        [
          "DealEscrow",
          "DealAgreement",
        ],
      );

    const dealId =
      readString(
        source.createArgument,
        "dealId",
      );

    const fulfiller =
      readRole(
        source.createArgument,
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

    const funded =
      templateName ===
      "DealEscrow";

    if (
      !funded &&
      readOptionalString(
        source.createArgument,
        "instrumentAdmin",
      ) !== undefined
    ) {
      throw new Error(
        "This VINSS deal uses Canton escrow: fund it before submitting fulfillment",
      );
    }

    await this.ledger
      .submitExercise({
        actingParty,

        commandId:
          `deal-fulfillment-${crypto.randomUUID()}`,

        templateId:
          funded
            ? cantonDealTemplates
                .escrow
            : cantonDealTemplates
                .agreement,

        contractId:
          sourceContractId,

        choice:
          funded
            ? "SubmitFundedFulfillment"
            : "SubmitFulfillment",

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

  async settle(
    actingParty:
      CantonPartyId,

    approvalContractId:
      CantonContractId,

    choiceContext:
      CantonChoiceContext,
  ): Promise<SettlementReceipt> {
    const approval =
      await this.requireContract(
        actingParty,
        approvalContractId,
        "FulfillmentApproval",
      );

    const dealId =
      readString(
        approval.createArgument,
        "dealId",
      );

    const fulfiller =
      readRole(
        approval.createArgument,
        "fulfiller",
        "seller",
      );

    if (
      actingParty !==
      fulfiller
    ) {
      throw new Error(
        "Only the VINSS fulfiller (payee) can settle the escrow",
      );
    }

    if (
      readOptionalString(
        approval.createArgument,
        "lockedAllocationCid",
      ) === undefined
    ) {
      throw new Error(
        "This VINSS deal has no Canton escrow to settle",
      );
    }

    // `choiceContext` comes from the registry's off-ledger API (see
    // docs/CANTON_COIN_SETUP.md) -- not fetched here.
    const submission =
      await this.ledger
        .submitExercise({
          actingParty,

          commandId:
            `deal-settle-${crypto.randomUUID()}`,

          templateId:
            cantonDealTemplates
              .fulfillmentApproval,

          contractId:
            approvalContractId,

          choice:
            "Settle",

          choiceArgument: {
            extraArgs: {
              context: {
                values:
                  choiceContext,
              },

              meta: {
                values: {},
              },
            },
          },
        });

    const receipt =
      await this
        .findLatestContract(
          actingParty,
          "SettlementReceipt",
          dealId,
          "VINSS SettlementReceipt was not found after settlement",
        );

    return {
      dealId,

      approvalContractId,

      receiptContractId:
        receipt.contractId,

      updateId:
        submission.updateId,

      settledAt:
        readString(
          receipt.createArgument,
          "settledAt",
        ),
    };
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

  private async requireContractOf(
    party:
      CantonPartyId,

    contractId:
      CantonContractId,

    templateNames:
      readonly CantonDealTemplateName[],
  ) {
    const contracts =
      await this.ledger
        .queryActiveContracts(
          party,
        );

    for (const contract of contracts) {
      if (
        contract.contractId !==
        contractId
      ) {
        continue;
      }

      const templateName =
        templateNames.find(
          (candidate) =>
            isCantonDealTemplate(
              contract.templateId,
              candidate,
            ),
        );

      if (templateName) {
        return {
          contract,
          templateName,
        };
      }
    }

    throw new Error(
      `VINSS ${templateNames.join(" or ")} not found: ${contractId}`,
    );
  }

  private async findLatestContract(
    party:
      CantonPartyId,

    templateName:
      CantonDealTemplateName,

    dealId:
      string,

    missingMessage:
      string,
  ) {
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
    const contract =
      await this
        .findLatestContract(
          party,
          templateName,
          dealId,
          missingMessage,
        );

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

  const instrumentAdmin =
    readOptionalString(
      value,
      "instrumentAdmin",
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

    ...(instrumentAdmin ===
      undefined
      ? {}
      : { instrumentAdmin }),
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
