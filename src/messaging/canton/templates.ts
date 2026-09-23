const PACKAGE =
  "vinss-canton-messaging";

const MODULE =
  "Vinss.Messaging";

export const cantonMessagingTemplates = {
  channel:
    `#${PACKAGE}:${MODULE}:EncryptedChannel`,

  delivery:
    `#${PACKAGE}:${MODULE}:MlsDelivery`,

  message:
    `#${PACKAGE}:${MODULE}:EncryptedMessage`,

  keyPackage:
    `#${PACKAGE}:${MODULE}:KeyPackageOffer`,
} as const;

export function isCantonTemplate(
  templateId: string,
  templateName: string,
): boolean {
  return templateId.endsWith(
    `:${MODULE}:${templateName}`,
  );
}
