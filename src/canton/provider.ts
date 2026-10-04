import type {
  CantonDisclosedContract,
} from "./ledger-client.js";

import type {
  CantonContractId,
  CantonPartyId,
  DealAgreement,
  DealTerms,
  SettlementReceipt,
} from "./types.js";

/**
 * The off-ledger choice context a CIP-56 registry (Amulet for Canton Coin,
 * a stablecoin issuer's registry for USDCx, ...) returns for a specific
 * choice invocation. Opaque to VINSS: fetched from the registry's API and
 * passed straight through to Allocation_ExecuteTransfer.
 */
export type CantonChoiceContext =
  Readonly<
    Record<string, unknown>
  >;

export interface CantonSettlementContext {
  choiceContextData:
    CantonChoiceContext;

  disclosedContracts:
    readonly CantonDisclosedContract[];
}

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
   * Payer (reviewer) references an Allocation their own wallet already
   * created (AllocationFactory_Allocate, off-ledger, see
   * docs/CANTON_COIN_SETUP.md) to fund the deal. Consumes the
   * DealAgreement and returns the DealEscrow contract id.
   */
  fundEscrow(
    actingParty: CantonPartyId,
    agreementContractId:
      CantonContractId,
    allocationContractId:
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
 * Deals that name an instrumentAdmin settle on-ledger through escrow, via
 * the Canton Network Token Standard; VINSS never holds the funds itself.
 * For other deals economic settlement remains a separate product layer.
 */
export interface CantonDealProvider
  extends
    CantonOfferProvider,
    CantonEscrowProvider,
    CantonFulfillmentProvider
{
  /**
   * Payee (fulfiller) claims the escrowed funds from an approved
   * fulfillment, by exercising the Allocation's own
   * Allocation_ExecuteTransfer. The caller supplies both the registry's
   * opaque choiceContextData and any disclosed contracts returned alongside it.
   */
  settle(
    actingParty: CantonPartyId,
    approvalContractId:
      CantonContractId,
    choiceContext:
      CantonSettlementContext,
  ): Promise<SettlementReceipt>;
}
