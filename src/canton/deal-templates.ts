const PACKAGE =
  "vinss-canton-messaging";

const MODULE =
  "Vinss.Deal";

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
} as const;

export type CantonDealTemplateName =
  | "DealProposal"
  | "DealAgreement"
  | "DealEscrow"
  | "DealFulfillment"
  | "DealRevisionRequest"
  | "FulfillmentApproval"
  | "SettlementReceipt";

export function isCantonDealTemplate(
  templateId: string,
  templateName:
    CantonDealTemplateName,
): boolean {
  return templateId.endsWith(
    `:${MODULE}:${templateName}`,
  );
}
