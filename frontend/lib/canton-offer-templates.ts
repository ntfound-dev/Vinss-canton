export type VinssOfferDealType =
  | "freelance"
  | "otc"
  | "goods"
  | "digital_goods"
  | "bounty"
  | "nft"
  | "other";

export type VinssOfferTemplateId =
  | "freelance"
  | "token_trade"
  | "physical_goods"
  | "digital_goods"
  | "bounty"
  | "nft_deal"
  | "custom_deal";

export type VinssOfferFieldType =
  | "text"
  | "number"
  | "textarea"
  | "choice"
  | "payment_asset";

export interface VinssOfferTemplateField {
  id: string;
  label: string;
  type: VinssOfferFieldType;
  placeholder?: string;
  optional?: boolean;
  advanced?: boolean;
  choices?: readonly {
    value: string;
    label: string;
  }[];
}

export interface VinssOfferTemplate {
  id: VinssOfferTemplateId;
  dealType: VinssOfferDealType;
  label: string;
  description: string;
  amountField: string;
  assetField: string;
  summaryFields: readonly string[];
  fields: readonly VinssOfferTemplateField[];
}

export const VINSS_OFFER_TEMPLATES:
  readonly VinssOfferTemplate[] = [
  {
    id: "freelance",
    dealType: "freelance",
    label: "Freelance",
    description: "Work agreement with deliverables, deadline and acceptance terms.",
    amountField: "freelance_payment_amount",
    assetField: "freelance_payment_asset",
    summaryFields: ["freelance_project"],
    fields: [
      { id: "freelance_project", label: "Project or service", type: "text", placeholder: "e.g. Build a responsive landing page" },
      { id: "freelance_payment_amount", label: "Payment amount", type: "number", placeholder: "500" },
      { id: "freelance_payment_asset", label: "Payment asset", type: "payment_asset", placeholder: "e.g. USDC, BTC, USDT" },
      { id: "freelance_deadline", label: "Delivery deadline", type: "text", optional: true, placeholder: "e.g. 2026-10-15 or 7 days" },
      { id: "freelance_deliverables", label: "Deliverables", type: "textarea", optional: true },
      { id: "freelance_acceptance_criteria", label: "Acceptance criteria", type: "textarea", optional: true, advanced: true },
      { id: "freelance_revision_limit", label: "Revision limit", type: "text", optional: true, advanced: true },
      { id: "freelance_work_stages", label: "Work stages", type: "text", optional: true, advanced: true },
    ],
  },
  {
    id: "token_trade",
    dealType: "otc",
    label: "Token Trade",
    description: "Private crypto-for-fiat or negotiated token trade.",
    amountField: "token_trade_crypto_amount",
    assetField: "token_trade_crypto_asset",
    summaryFields: ["token_trade_direction", "token_trade_fiat_amount", "token_trade_fiat_currency"],
    fields: [
      { id: "token_trade_direction", label: "Your side", type: "choice", choices: [
        { value: "sell_crypto", label: "Sell crypto" },
        { value: "buy_crypto", label: "Buy crypto" },
      ]},
      { id: "token_trade_crypto_amount", label: "Crypto amount", type: "number", placeholder: "1" },
      { id: "token_trade_crypto_asset", label: "Crypto asset", type: "payment_asset", placeholder: "e.g. BTC, ETH, USDC" },
      { id: "token_trade_fiat_amount", label: "Fiat amount", type: "number", placeholder: "1000000" },
      { id: "token_trade_fiat_currency", label: "Fiat currency", type: "text", placeholder: "IDR" },
      { id: "token_trade_payment_method", label: "Fiat payment method", type: "text", optional: true },
      { id: "token_trade_payment_deadline", label: "Payment deadline", type: "text", optional: true, advanced: true },
    ],
  },
  {
    id: "physical_goods",
    dealType: "goods",
    label: "Physical Goods",
    description: "Item purchase with quantity, delivery and inspection terms.",
    amountField: "physical_goods_total_price",
    assetField: "physical_goods_payment_asset",
    summaryFields: ["physical_goods_item", "physical_goods_quantity"],
    fields: [
      { id: "physical_goods_item", label: "Item", type: "text", placeholder: "e.g. Used laptop" },
      { id: "physical_goods_quantity", label: "Quantity", type: "number", placeholder: "1" },
      { id: "physical_goods_total_price", label: "Total price", type: "number", placeholder: "700" },
      { id: "physical_goods_payment_asset", label: "Payment asset", type: "payment_asset", placeholder: "e.g. USDC" },
      { id: "physical_goods_delivery_method", label: "Delivery method", type: "text", optional: true },
      { id: "physical_goods_delivery_deadline", label: "Delivery deadline", type: "text", optional: true, advanced: true },
      { id: "physical_goods_inspection_window", label: "Inspection window", type: "text", optional: true, advanced: true },
    ],
  },
  {
    id: "digital_goods",
    dealType: "digital_goods",
    label: "Digital Goods",
    description: "Files, software, licenses or digital access.",
    amountField: "digital_goods_price",
    assetField: "digital_goods_payment_asset",
    summaryFields: ["digital_goods_item"],
    fields: [
      { id: "digital_goods_item", label: "Digital item", type: "text", placeholder: "e.g. Source code license" },
      { id: "digital_goods_price", label: "Price", type: "number", placeholder: "250" },
      { id: "digital_goods_payment_asset", label: "Payment asset", type: "payment_asset", placeholder: "e.g. USDC" },
      { id: "digital_goods_license_rights", label: "License or usage rights", type: "textarea", optional: true, advanced: true },
      { id: "digital_goods_delivery_method", label: "Delivery method", type: "text", optional: true },
      { id: "digital_goods_acceptance_window", label: "Acceptance window", type: "text", optional: true, advanced: true },
    ],
  },
  {
    id: "bounty",
    dealType: "bounty",
    label: "Bounty",
    description: "Reward agreement for a clearly defined task or result.",
    amountField: "bounty_reward_amount",
    assetField: "bounty_reward_asset",
    summaryFields: ["bounty_task"],
    fields: [
      { id: "bounty_task", label: "Task or result", type: "text", placeholder: "e.g. Fix the mobile reconnect bug" },
      { id: "bounty_reward_amount", label: "Reward amount", type: "number", placeholder: "200" },
      { id: "bounty_reward_asset", label: "Reward asset", type: "payment_asset", placeholder: "e.g. USDC" },
      { id: "bounty_deadline", label: "Deadline", type: "text", optional: true },
      { id: "bounty_success_criteria", label: "Success criteria", type: "textarea", optional: true },
      { id: "bounty_submission_method", label: "Submission method", type: "text", optional: true, advanced: true },
    ],
  },
  {
    id: "nft_deal",
    dealType: "nft",
    label: "NFT Deal",
    description: "Private negotiated NFT purchase with price and transfer terms.",
    amountField: "nft_deal_price",
    assetField: "nft_deal_payment_asset",
    summaryFields: ["nft_deal_collection", "nft_deal_token_id"],
    fields: [
      { id: "nft_deal_collection", label: "Collection or contract", type: "text" },
      { id: "nft_deal_token_id", label: "Token ID", type: "text" },
      { id: "nft_deal_price", label: "Price", type: "number", placeholder: "3500" },
      { id: "nft_deal_payment_asset", label: "Payment asset", type: "payment_asset", placeholder: "e.g. ETH, USDC" },
      { id: "nft_deal_transfer_deadline", label: "Transfer deadline", type: "text", optional: true, advanced: true },
      { id: "nft_deal_transfer_condition", label: "Transfer condition", type: "textarea", optional: true, advanced: true },
    ],
  },
  {
    id: "custom_deal",
    dealType: "other",
    label: "Custom Deal",
    description: "Flexible agreement for a deal that does not fit another template.",
    amountField: "custom_deal_value",
    assetField: "custom_deal_value_asset",
    summaryFields: ["custom_deal_title"],
    fields: [
      { id: "custom_deal_title", label: "Deal title", type: "text", placeholder: "e.g. Private equipment rental" },
      { id: "custom_deal_value", label: "Deal value", type: "number", placeholder: "500" },
      { id: "custom_deal_value_asset", label: "Value asset", type: "payment_asset", placeholder: "e.g. USDC" },
      { id: "custom_deal_terms", label: "Terms", type: "textarea", optional: true },
      { id: "custom_deal_completion_condition", label: "Completion condition", type: "textarea", optional: true, advanced: true },
      { id: "custom_deal_deadline", label: "Deadline", type: "text", optional: true, advanced: true },
    ],
  },
];

export const INITIAL_OFFER_VALUES:
  Readonly<Record<string, string>> = {
  token_trade_direction: "sell_crypto",
  physical_goods_quantity: "1",
};

export function offerTemplateById(
  id: VinssOfferTemplateId,
): VinssOfferTemplate {
  return VINSS_OFFER_TEMPLATES.find(
    (template) => template.id === id,
  ) ?? VINSS_OFFER_TEMPLATES[0];
}

export function offerTemplateForDealType(
  dealType: string,
): VinssOfferTemplate {
  return VINSS_OFFER_TEMPLATES.find(
    (template) => template.dealType === dealType,
  ) ?? VINSS_OFFER_TEMPLATES[VINSS_OFFER_TEMPLATES.length - 1];
}

export function offerSummary(
  template: VinssOfferTemplate,
  values: Readonly<Record<string, string>>,
): string {
  const parts = template.summaryFields
    .map((field) => values[field]?.trim())
    .filter((value): value is string => Boolean(value));

  return parts.length > 0
    ? parts.join(" · ")
    : template.label;
}
