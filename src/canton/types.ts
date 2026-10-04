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

  // The admin Party of the CIP-56 registry backing this deal's instrument
  // (e.g. Amulet for Canton Coin, or a stablecoin issuer's registry for
  // USDCx). When set, the payer (reviewer) must fund a matching Allocation
  // (fundEscrow) before fulfillment. Omitted: the deal keeps the original
  // flow, without Canton escrow. Not tied to one instrument -- which
  // registry is just whichever admin party this names.
  instrumentAdmin?: CantonPartyId;

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

export interface SettlementReceipt {
  dealId: string;
  approvalContractId: CantonContractId;
  receiptContractId: CantonContractId;
  updateId: string;
  settledAt: string;
}
