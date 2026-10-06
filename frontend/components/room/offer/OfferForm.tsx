"use client";

import { useState } from "react";

import {
  INITIAL_OFFER_VALUES,
  VINSS_OFFER_TEMPLATES,
  offerSummary,
  offerTemplateById,
  type VinssOfferTemplateId,
  type VinssOfferTemplateField,
} from "@/lib/canton-offer-templates";

import type { CantonRoomOfferInput } from "@/lib/canton-room-runtime";

interface OfferFormProps {
  busy: boolean;
  disabled?: boolean;
  onSubmit(input: CantonRoomOfferInput): Promise<boolean>;
  onCancel(): void;
  initialValues?: Record<string, string>;
}

const OFFER_HELP = {
  title: "How does this Offer work?",
  paragraphs: [
    "An Offer is a private proposal between you and the other participant. Use it to record the deal terms both sides should understand before agreeing.",
    "Choose the Deal Type that best matches the agreement. VINSS adapts the form so you only enter terms relevant to that kind of deal.",
    "Complete the main terms first. Optional fields can be left empty when they are not important to your agreement.",
    "More Terms is for additional conditions that can make the agreement clearer, such as deadlines, acceptance requirements, revisions, delivery conditions or inspection periods.",
    "Before anything is sent, Review Offer lets you check the complete proposal. The other participant can then Accept or Reject it.",
    "For an escrow-enabled offer, accepting requests funding from the payer’s wallet. Delivery, approval and settlement are separate steps.",
  ],
};

export function OfferForm({
  busy,
  disabled = false,
  onSubmit,
  onCancel,
  initialValues,
}: OfferFormProps) {
  const [templateId, setTemplateId] =
    useState<VinssOfferTemplateId>("freelance");

  const [offerValues, setOfferValues] = useState<Record<string, string>>({
    ...INITIAL_OFFER_VALUES,
    ...initialValues,
  });

  const [expiresInHours, setExpiresInHours] = useState("24");

  const [showAdvanced, setShowAdvanced] = useState(false);

  const [reviewing, setReviewing] = useState(false);

  const [helpOpen, setHelpOpen] = useState(false);

  const template = offerTemplateById(templateId);

  const mainFields = template.fields.filter((field) => !field.advanced);

  const advancedFields = template.fields.filter((field) => field.advanced);

  const requiredReady = template.fields
    .filter((field) => !field.optional)
    .every((field) => Boolean(offerValues[field.id]?.trim()));

  function setValue(fieldId: string, next: string) {
    setOfferValues((current) => ({
      ...current,
      [fieldId]: next,
    }));
  }

  function renderField(field: VinssOfferTemplateField) {
    const value = offerValues[field.id] ?? "";

    if (field.type === "choice") {
      return (
        <label key={field.id} className="space-y-1">
          <span className="text-[12px] uppercase tracking-[0.11em] text-paper/65">
            {field.label}
            {field.optional ? " · optional" : ""}
          </span>
          <select
            value={value}
            disabled={busy || disabled}
            onChange={(event) => setValue(field.id, event.target.value)}
            className="h-10 w-full rounded-lg border border-wire/65 bg-vault px-3 text-[14px] text-paper/75 outline-none disabled:opacity-40"
          >
            {field.choices?.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (field.type === "textarea") {
      return (
        <label key={field.id} className="space-y-1 sm:col-span-2">
          <span className="text-[12px] uppercase tracking-[0.11em] text-paper/65">
            {field.label}
            {field.optional ? " · optional" : ""}
          </span>
          <textarea
            rows={2}
            value={value}
            disabled={busy || disabled}
            onChange={(event) => setValue(field.id, event.target.value)}
            placeholder={field.placeholder}
            className="w-full resize-none rounded-lg border border-wire/65 bg-vault px-3 py-2.5 text-[14px] text-paper/75 outline-none placeholder:text-paper/55 disabled:opacity-40"
          />
        </label>
      );
    }

    return (
      <label key={field.id} className="space-y-1">
        <span className="text-[12px] uppercase tracking-[0.11em] text-paper/65">
          {field.label}
          {field.optional ? " · optional" : ""}
        </span>
        <input
          type={field.type === "number" ? "number" : "text"}
          value={value}
          disabled={busy || disabled}
          onChange={(event) => setValue(field.id, event.target.value)}
          placeholder={field.placeholder}
          className="h-10 w-full rounded-lg border border-wire/65 bg-vault px-3 text-[14px] text-paper/75 outline-none placeholder:text-paper/55 disabled:opacity-40"
        />
      </label>
    );
  }

  async function handleCreate() {
    if (!requiredReady || busy || disabled) {
      return;
    }

    const fields: Record<string, string> = {};

    for (const field of template.fields) {
      const value = offerValues[field.id]?.trim();
      if (value) {
        fields[field.id] = value;
      }
    }

    const expiry = Number(expiresInHours);

    const created = await onSubmit({
      dealType: template.dealType,
      amount: fields[template.amountField] ?? "",
      instrumentId: fields[template.assetField] ?? "",
      terms: offerSummary(template, fields),
      fields,
      settlementRail: "canton",
      expiresInHours: Number.isFinite(expiry) ? expiry : 24,
    });

    if (created) {
      setOfferValues({ ...INITIAL_OFFER_VALUES });
      setExpiresInHours("24");
      setShowAdvanced(false);
      setReviewing(false);
      onCancel();
    }
  }

  if (reviewing) {
    const filled = template.fields.filter((field) =>
      Boolean(offerValues[field.id]?.trim()),
    );

    return (
      <div className="mt-3 rounded-xl border border-signal/25 bg-vault p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-medium text-paper/78">
              Review Offer
            </p>
            <p className="mt-1 text-[12px] leading-4 text-paper/65">
              Check the proposal before it is sent to the counterparty on
              Canton.
            </p>
          </div>
          <span className="rounded-full border border-amber-400/25 bg-amber-400/[0.06] px-2 py-0.5 text-[12px] uppercase tracking-[0.12em] text-amber-300/75">
            {template.label}
          </span>
        </div>

        <div className="mt-3 space-y-2 rounded-lg border border-wire/55 bg-vault/30 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12px] text-paper/65">Summary</span>
            <span className="text-[12px] font-medium text-paper/80">
              {offerSummary(template, offerValues)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12px] text-paper/65">Amount</span>
            <span className="text-[13px] text-paper/88">
              {offerValues[template.amountField] ?? "—"}{" "}
              {offerValues[template.assetField] ?? ""}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12px] text-paper/65">Expires</span>
            <span className="text-[14px] text-paper/70">
              {expiresInHours} hours
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12px] text-paper/65">Settlement</span>
            <span className="text-[14px] text-paper/70">Canton</span>
          </div>
        </div>

        {filled.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-wire/50 pt-2.5">
            {filled.map((field) => (
              <p
                key={field.id}
                className="text-[13px] leading-relaxed text-paper/48"
              >
                <span className="text-paper/65">{field.label}</span>
                {" · "}
                <span className="text-paper/62">{offerValues[field.id]}</span>
              </p>
            ))}
          </div>
        )}

        <div className="mt-3.5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setReviewing(false)}
            className="h-9 rounded-lg border border-wire/65 px-3 text-[12px] uppercase tracking-[0.12em] text-paper/45 disabled:opacity-30"
          >
            Back
          </button>
          <button
            type="button"
            disabled={busy || !requiredReady}
            onClick={() => void handleCreate()}
            className="h-9 rounded-lg border border-signal/35 bg-signal/[0.08] px-3 text-[12px] uppercase tracking-[0.12em] text-signal disabled:opacity-30"
          >
            {busy ? "Creating…" : "Confirm & Create"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-wire/65 bg-black/15 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
            <select
              value={templateId}
              disabled={busy || disabled}
              onChange={(event) => {
                setTemplateId(event.target.value as VinssOfferTemplateId);
                setShowAdvanced(false);
                setReviewing(false);
              }}
              className="h-10 rounded-lg border border-wire/65 bg-vault px-3 text-[14px] text-paper/75 outline-none disabled:opacity-40"
            >
              {VINSS_OFFER_TEMPLATES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>

            <p className="self-center text-[12px] leading-4 text-paper/65">
              {template.description}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setHelpOpen((v) => !v)}
          className="shrink-0 rounded-lg border border-wire/55 px-2 py-1.5 text-[12px] uppercase tracking-[0.11em] text-paper/40 hover:text-paper/65"
          aria-label="How does this Offer work?"
        >
          ?
        </button>
      </div>

      {helpOpen && (
        <div className="mt-3 rounded-lg border border-signal/15 bg-signal/[0.03] px-3 py-2.5">
          <p className="text-[14px] font-medium text-paper/70">
            {OFFER_HELP.title}
          </p>
          <div className="mt-2 space-y-1.5">
            {OFFER_HELP.paragraphs.map((text) => (
              <p
                key={text.slice(0, 24)}
                className="text-[12px] leading-4 text-paper/40"
              >
                {text}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {mainFields.map((field) => renderField(field))}

        <label className="space-y-1">
          <span className="text-[12px] uppercase tracking-[0.11em] text-paper/65">
            Offer expiry · hours
          </span>
          <input
            type="number"
            min="1"
            max="168"
            value={expiresInHours}
            disabled={busy || disabled}
            onChange={(event) => setExpiresInHours(event.target.value)}
            className="h-10 w-full rounded-lg border border-wire/65 bg-vault px-3 text-[14px] text-paper/75 outline-none disabled:opacity-40"
          />
        </label>
      </div>

      {advancedFields.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-[12px] uppercase tracking-[0.12em] text-paper/40 transition hover:text-paper/65 disabled:opacity-30"
          >
            {showAdvanced ? "Hide More Terms" : "More Terms"}
          </button>

          {showAdvanced && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {advancedFields.map((field) => renderField(field))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3.5 flex justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="h-9 rounded-lg border border-wire/65 px-3 text-[12px] uppercase tracking-[0.12em] text-paper/45 disabled:opacity-30"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!requiredReady || busy || disabled}
          onClick={() => setReviewing(true)}
          className="h-9 rounded-lg border border-signal/35 px-3 text-[12px] uppercase tracking-[0.12em] text-signal disabled:opacity-30"
        >
          Review Offer
        </button>
      </div>
    </div>
  );
}
