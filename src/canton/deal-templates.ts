const PACKAGE =
  "vinss-canton-messaging";

const MODULE =
  "Vinss.Deal";

export const cantonDealTemplates = {
  proposal:
    `#${PACKAGE}:${MODULE}:DealProposal`,

  agreement:
    `#${PACKAGE}:${MODULE}:DealAgreement`,
} as const;

export function isCantonDealTemplate(
  templateId: string,
  templateName:
    | "DealProposal"
    | "DealAgreement",
): boolean {
  return templateId.endsWith(
    `:${MODULE}:${templateName}`,
  );
}
