const PACKAGE =
  "vinss-canton-messaging";

const MODULE =
  "Vinss.Deal";

const CUSTODY_MODULE =
  "Vinss.Custody";

export const cantonDealTemplates = {
  proposal:
    `#${PACKAGE}:${MODULE}:DealProposal`,

  agreement:
    `#${PACKAGE}:${MODULE}:DealAgreement`,

  escrow:
    `#${PACKAGE}:${MODULE}:DealEscrow`,

  fulfillment:
    `#${PACKAGE}:${MODULE}:DealFulfillment`,

  revisionRequest:
    `#${PACKAGE}:${MODULE}:DealRevisionRequest`,

  fulfillmentApproval:
    `#${PACKAGE}:${MODULE}:FulfillmentApproval`,

  settlementReceipt:
    `#${PACKAGE}:${MODULE}:SettlementReceipt`,

  cashHolding:
    `#${PACKAGE}:${CUSTODY_MODULE}:CashHolding`,

  lockedHolding:
    `#${PACKAGE}:${CUSTODY_MODULE}:LockedHolding`,
} as const;

export type CantonDealTemplateName =
  | "DealProposal"
  | "DealAgreement"
  | "DealEscrow"
  | "DealFulfillment"
  | "DealRevisionRequest"
  | "FulfillmentApproval"
  | "SettlementReceipt"
  | "CashHolding"
  | "LockedHolding";

const templateModules: Readonly<
  Record<
    CantonDealTemplateName,
    string
  >
> = {
  DealProposal: MODULE,
  DealAgreement: MODULE,
  DealEscrow: MODULE,
  DealFulfillment: MODULE,
  DealRevisionRequest: MODULE,
  FulfillmentApproval: MODULE,
  SettlementReceipt: MODULE,
  CashHolding: CUSTODY_MODULE,
  LockedHolding: CUSTODY_MODULE,
};

export function isCantonDealTemplate(
  templateId: string,
  templateName:
    CantonDealTemplateName,
): boolean {
  return templateId.endsWith(
    `:${templateModules[templateName]}:${templateName}`,
  );
}
