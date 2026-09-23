export type CantonPartyId = string;
export type CantonContractId = string;

export interface DealTerms {
  dealId: string;
  conversationId: string;
  seller: CantonPartyId;
  buyer: CantonPartyId;
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
  agreementContractId: CantonContractId;
  updateId: string;
  settledAt: string;
}
