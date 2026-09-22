import type {
  CantonContractId,
  CantonPartyId,
  DealAgreement,
  DealTerms,
  SettlementReceipt,
} from "./types.js";

/**
 * Canton boundary for VINSS business state.
 *
 * Keep messaging crypto completely separate from this interface.
 */
export interface CantonDealProvider {
  createProposal(
    actingParty: CantonPartyId,
    terms: DealTerms,
  ): Promise<CantonContractId>;

  acceptProposal(
    actingParty: CantonPartyId,
    proposalContractId: CantonContractId,
  ): Promise<DealAgreement>;

  submitFulfillment(
    actingParty: CantonPartyId,
    agreementContractId: CantonContractId,
    fulfillmentHash: string,
  ): Promise<CantonContractId>;

  settle(
    actingParty: CantonPartyId,
    agreementContractId: CantonContractId,
  ): Promise<SettlementReceipt>;
}
