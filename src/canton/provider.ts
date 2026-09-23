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

/**
 * Full VINSS Canton business workflow.
 *
 * Offer/Agreement lands first.
 * Fulfillment/settlement remains the next product layer.
 */
export interface CantonDealProvider
  extends CantonOfferProvider
{
  submitFulfillment(
    actingParty: CantonPartyId,
    agreementContractId:
      CantonContractId,
    fulfillmentHash: string,
  ): Promise<CantonContractId>;

  settle(
    actingParty: CantonPartyId,
    agreementContractId:
      CantonContractId,
  ): Promise<SettlementReceipt>;
}
