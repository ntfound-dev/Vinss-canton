import type {
  CantonContractId,
  CantonHoldingTerms,
  CantonPartyId,
  DealAgreement,
  DealTerms,
  SettlementReceipt,
} from "./types.js";

export interface CantonOfferProvider {
  createProposal(
    actingParty: CantonPartyId,
    terms: DealTerms,
  ): Promise<CantonContractId>;

  acceptProposal(
    actingParty: CantonPartyId,
    proposalContractId:
      CantonContractId,
  ): Promise<DealAgreement>;

  rejectProposal(
    actingParty: CantonPartyId,
    proposalContractId:
      CantonContractId,
  ): Promise<void>;
}

export interface CantonEscrowProvider {
  /**
   * Custodian only: acknowledges a deposit as an on-ledger holding.
   * Returns the CashHolding contract id.
   */
  issueHolding(
    actingParty: CantonPartyId,
    holding: CantonHoldingTerms,
  ): Promise<CantonContractId>;

  /**
   * Payer (reviewer) locks a holding into the deal. Consumes the
   * DealAgreement and returns the DealEscrow contract id.
   */
  fundEscrow(
    actingParty: CantonPartyId,
    agreementContractId:
      CantonContractId,
    holdingContractId:
      CantonContractId,
  ): Promise<CantonContractId>;
}

export interface CantonFulfillmentProvider {
  /**
   * `sourceContractId` is the DealEscrow of a funded deal, or the
   * DealAgreement of a deal without Canton escrow.
   */
  submitFulfillment(
    actingParty: CantonPartyId,
    sourceContractId:
      CantonContractId,
    fulfillmentHash: string,
  ): Promise<CantonContractId>;

  approveFulfillment(
    actingParty: CantonPartyId,
    fulfillmentContractId:
      CantonContractId,
  ): Promise<CantonContractId>;

  requestRevision(
    actingParty: CantonPartyId,
    fulfillmentContractId:
      CantonContractId,
    reviewHash: string,
  ): Promise<CantonContractId>;

  submitRevision(
    actingParty: CantonPartyId,
    revisionRequestContractId:
      CantonContractId,
    fulfillmentHash: string,
  ): Promise<CantonContractId>;
}

/**
 * Full VINSS Canton business workflow.
 *
 * Offer/Agreement and Fulfillment are explicit.
 * Deals that name a custodian settle on-ledger through escrow; for other
 * deals economic settlement remains a separate product layer.
 */
export interface CantonDealProvider
  extends
    CantonOfferProvider,
    CantonEscrowProvider,
    CantonFulfillmentProvider
{
  /**
   * Payee (fulfiller) claims the escrowed funds from an approved
   * fulfillment.
   */
  settle(
    actingParty: CantonPartyId,
    approvalContractId:
      CantonContractId,
  ): Promise<SettlementReceipt>;
}
