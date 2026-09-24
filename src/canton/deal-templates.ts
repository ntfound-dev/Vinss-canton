const PACKAGE =
  "vinss-canton-messaging";

const MODULE =
  "Vinss.Deal";

export const cantonDealTemplates = {
  proposal:
    `#${PACKAGE}:${MODULE}:DealProposal`,

  agreement:
    `#${PACKAGE}:${MODULE}:DealAgreement`,

  fulfillment:
    `#${PACKAGE}:${MODULE}:DealFulfillment`,

  revisionRequest:
    `#${PACKAGE}:${MODULE}:DealRevisionRequest`,

  fulfillmentApproval:
    `#${PACKAGE}:${MODULE}:FulfillmentApproval`,
} as const;

export type CantonDealTemplateName =
  | "DealProposal"
  | "DealAgreement"
  | "DealFulfillment"
  | "DealRevisionRequest"
  | "FulfillmentApproval";

export function isCantonDealTemplate(
  templateId: string,
  templateName:
    CantonDealTemplateName,
): boolean {
  return templateId.endsWith(
    `:${MODULE}:${templateName}`,
  );
}
