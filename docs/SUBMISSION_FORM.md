# VINSS - submission text

Copy the relevant section into the Season 3 form. Confirm live links, the selected track and video URL before submitting. The six sections match the judging criteria published in the supplied Season 3 materials.

## Project name

VINSS

## Elevator pitch

VINSS is a private deal workspace on Canton. A client and freelancer join with a wallet-connected invite link or QR, agree on work inside an encrypted conversation, fund escrow, review delivery and settle payment after approval. OpenMLS protects detailed messages and terms. Canton records the agreement, authorized actions and settlement receipt.

## Value / Problem Statement

A direct freelance deal often spans a chat app, a job board and a separate payment service. The scope changes in conversation while funding and payment status live elsewhere. VINSS brings those steps into one room: private discussion, an accepted offer, allocation-backed funding, delivery review and settlement. The intended benefit is a clearer shared understanding of the work and its payment state. The current Canton MVP provides a concrete workflow to validate with client-freelancer pairs.

## ICP / Audience

The proposed first audience is independent freelancers and clients buying a bounded digital deliverable, such as development, design or writing. Freelancers need to confirm the accepted scope and whether the agreement is funded. Clients need to review delivery against the terms and understand payment approval. A small team managing repeat work is the proposed audience for optional VIP tools. These are audience hypotheses, not established customer traction.

## Metrics / Validation

The repository records a real Canton DevNet escrow settlement on 6 October 2026: 1.0000000000 Amulet transferred through the Token Standard and a VINSS SettlementReceipt recorded the receiver Holding reference. Transaction and contract IDs are in CANTON_DEVNET_E2E.md.

On 7 October 2026, 69 automated tests across 24 files passed. The messaging integration uses actual OpenMLS WASM and production Canton transport over a simulated ledger. It covers Alice-Bob delivery, three-member groups, delayed readers, local history/checkpoint reload, QR decoding and ciphertext-only message contracts. This is local verification, separate from current live wallet authorization. A fresh isolated-wallet run of the updated messaging release and user interviews remain to be recorded.

Proposed pilot measures are successful invite joins, completed funded workflows versus attempts, wallet failures, time to agreement/settlement and repeat use. No revenue, retention or completed interview figures are claimed.

## GTM Materials

Begin with direct invitations between a client and freelancer, so the first useful workflow does not depend on a large marketplace. Recruit a proposed cohort of 3-5 pairs through freelance communities and Canton builder/community contacts, initially using test tokens. Publish consented case studies after completed workflows and test whether participants bring another counterparty.

Add self-service job publication after the private flow works reliably. Validate willingness to pay before implementing optional VIP subscriptions. Reusable templates, more listings and deal exports appear in the membership preview. Pricing, billing, Points rules and any future token model remain undecided. No confirmed partnerships or network-reward income are assumed.

## MVP Materials

The current code implements Canton wallet integration, signed invitation/installation binding, downloadable invite QR, real OpenMLS private and group messaging, local plaintext history, encrypted MLS checkpoints, private offers, delivery review and Token Standard Allocation-backed escrow settlement. Published jobs can create a private room and pre-fill an offer draft. The committed live listing dataset is currently empty, and sample jobs or /demo use a simulated preview flow.

Groups support messaging but not offers or escrow. The current contracts have no dispute/refund choice. History does not synchronize to another device. Acceptance and allocation/funding are separate wallet operations.

App: https://vinss-canton.vercel.app

Public repository: https://github.com/ntfound-dev/Vinss-canton

Code and evidence map: [SUBMISSION.md](SUBMISSION.md)

## Pitch Materials

[Pitch deck PDF](vinss-deck.pdf) and [editable deck](vinss-deck.pptx) cover the product, user problem, workflow, Canton privacy/authority, technical evidence, initial audience, business/distribution and pilot plan. One-page PDFs provide separate value, ICP, validation, GTM and technical summaries. [Document index](README.md).

## Submission fields to finish

- Selected competition track: confirm against the actual Season 3 form.
- Demo video URL: add after recording the current wallet-connected workflow.
- Team/member fields: enter the real team details in the form.

A public site URL does not establish signed-out access or successful wallet connectivity. Check both before submitting the link. Keep tokens and credentials out of the form, repository and video.
