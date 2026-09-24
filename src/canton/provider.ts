import type {
  CantonContractId,
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

export interface CantonFulfillmentProvider {
  submitFulfillment(
    actingParty: CantonPartyId,
    agreementContractId:
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
 * Economic settlement remains a separate product layer.
 */
export interface CantonDealProvider
  extends
    CantonOfferProvider,
    CantonFulfillmentProvider
{
  settle(
    actingParty: CantonPartyId,
    agreementContractId:
      CantonContractId,
  ): Promise<SettlementReceipt>;
}
