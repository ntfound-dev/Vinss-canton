# VINSS - pitch outline

Eight slides for the Season 3 product and business story. The editable deck and PDF use this outline.

## 1. VINSS on Canton

Private deals between people

Discuss the work privately. Agree on an offer. Settle payment after approval.

Canton MVP - HackCanton League Season 3

Sources: README.md; docs/BUSINESS_BRIEF.md

## 2. The client-work problem

The agreement and payment status live in different places.

**Client.** Connect the delivered work to the accepted scope. Understand what approving it authorizes.

**Freelancer.** Confirm which terms were accepted and whether payment is funded. Track what remains before settlement.

Initial use case: one client, one freelancer, one bounded digital deliverable.

Sources: docs/VALUE_STATEMENT.md; docs/ICP_AUDIENCE.md

## 3. The VINSS workflow

A private room connects work terms to the ledger record.

**01. Invite.** Open a link or QR and connect a Canton wallet.

**02. Agree.** Discuss work and accept an offer with private terms.

**03. Fund escrow.** Create the allocation-backed escrow and submit work.

**04. Review and settle.** Review delivery, approve and produce a settlement receipt.

Groups support encrypted discussion. Offers and escrow remain between two Parties.

Sources: frontend/lib/canton-invite.ts; frontend/lib/canton-room-runtime.ts; daml/Vinss/Deal.daml

## 4. Why Canton

Content privacy and workflow authority have separate jobs.

**OpenMLS.** The browser encrypts messages, detailed offer terms and group membership content.

**Canton.** Parties sign contracts. Ledger visibility limits disclosure. Daml enforces deal actions and CIP-56 connects settlement.

Authorized ledger viewers can see metadata and deal amounts. Local history is plaintext in the browser.

Sources: docs/ARCHITECTURE.md; daml/Vinss/Messaging.daml; daml/Vinss/Deal.daml

## 5. Evidence already recorded

Evidence / Result / Scope

DevNet escrow, 6 Oct 2026 / 1 CC settled, receipt and Holding IDs / Earlier real network run

Automated tests, 7 Oct 2026 / 69 passed across 24 files / Local tests

OpenMLS messaging scenario / 10 messages, three-member group / Real WASM, simulated ledger

A fresh live wallet run of the updated messaging release remains to be recorded.

Sources: docs/CANTON_DEVNET_E2E.md#verified-devnet-run-evidence; docs/MESSAGING_E2E.md; tests/integration/messaging-scenario.mjs

## 6. The first users

Start with direct clients, then expand marketplace supply.

**Initial pilot.** A proposed 3-5 pairs doing design, development or writing work. Begin with compatible wallets and test tokens.

**What to learn.** Successful invite joins, complete funded workflows, wallet failures, repeat use and participant interviews.

These are pilot targets and proposed metrics. No paying-user or retention figures are claimed.

Sources: docs/ICP_AUDIENCE.md; docs/PILOT_PLAN.md

## 7. Business and distribution

Completed engagements can bring the next client.

**Acquisition.** Recruit freelance pairs through proposed community channels. Use completed workflows as consented case studies and test counterparty referrals.

**Optional VIP.** Validate willingness to pay for repeat-project tools. Templates, listings and exports appear in the preview. Pricing and billing remain pending.

Points are planned. No transaction-fee schedule, reward income or confirmed partnership is assumed.

Sources: docs/GTM.md; docs/BUSINESS_BRIEF.md; frontend/app/rewards/page.tsx

## 8. The next Canton pilot

Verify the current release, then validate repeat use.

**Immediate proof.** Record isolated-wallet invitation, private chat, group messaging and settlement. Retain actual update IDs and visibility results.

**Expansion gate.** Resolve reliability failures and define dispute/refund handling. Then add self-service publishing and validate VIP. Multichain comes later.

App: vinss-canton.vercel.app     Repository: github.com/ntfound-dev/Vinss-canton

Sources: docs/PILOT_PLAN.md; docs/SUBMISSION.md

