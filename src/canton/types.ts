export type CantonPartyId = string;
export type CantonContractId = string;

export interface DealTerms {
  dealId: string;
  conversationId: string;
  seller: CantonPartyId;
  buyer: CantonPartyId;

  // Optional at the domain boundary for backward compatibility.
  // New Canton proposals always materialize both roles explicitly.
  fulfiller?: CantonPartyId;
  reviewer?: CantonPartyId;

  // Party that holds the escrowed value. When set, the payer (reviewer) must
  // lock a holding issued by this custodian (fundEscrow) before fulfillment.
  // When omitted the deal keeps the original flow, without Canton escrow.
  custodian?: CantonPartyId;

  termsHash: string;
  amount: string;
  instrumentId: string;
  expiresAt: string;
}

export interface DealAgreement {
  contractId: CantonContractId;
  terms: DealTerms;
  acceptedAt: string;
}

/**
 * Custodian-issued acknowledgement that `owner` is entitled to `amount` of
 * `instrumentId`. The custodian holds the backing value off-ledger.
 */
export interface CantonHoldingTerms {
  holdingId: string;
  owner: CantonPartyId;
  amount: string;
  instrumentId: string;
}

export interface SettlementReceipt {
  dealId: string;
  approvalContractId: CantonContractId;
  receiptContractId: CantonContractId;
  updateId: string;
  settledAt: string;
}
