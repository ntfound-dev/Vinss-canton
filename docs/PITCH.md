# VINSS - pitch outline

Ten slides covering the product, payment mechanism, evidence and business plan.

## 1. VINSS

Private chat.
Agreed work.
Escrow settlement.

A private deal workspace for clients and freelancers on Canton.

HackCanton League Season 3

Sources: [README.md](../README.md), [docs/BUSINESS_BRIEF.md](BUSINESS_BRIEF.md)

## 2. The gap between chat and payment

A direct client deal often loses its shared context.

**The freelancer needs to know**

Which scope did the client accept?
Is the payment funded?
What remains before settlement?

**The client needs to know**

What did the offer include?
Does the delivery match?
What does approval authorize?

Initial use case: one client and one freelancer completing a defined digital task.

Sources: [docs/VALUE_STATEMENT.md](VALUE_STATEMENT.md)

## 3. One room for the deal

An invite link or QR brings both people into the same workflow.

01. **Discuss and agree** Private messages lead to an accepted offer.

02. **Fund escrow** The client authorizes the payment allocation.

03. **Deliver and review** The freelancer submits work. The client approves or requests revision.

04. **Settle payment** After approval, the freelancer settles and receives a ledger receipt.

Encrypted group chat supports team discussion. Escrow currently uses two-person rooms.

Sources: [docs/ESCROW.md](ESCROW.md), [frontend/lib/canton-room-runtime.ts](../frontend/lib/canton-room-runtime.ts)

## 4. Escrow has explicit payment states

Acceptance, funding and settlement each require their own action.

| State | Who acts | What the state means |
| --- | --- | --- |
| Accepted | Offer accepter | Both people have an agreement. |
| Funded | Client / reviewer | VINSS has validated the referenced token allocation. |
| Approved | Client / reviewer | The submitted work has approval for the VINSS settlement path. |
| Settled | Freelancer / fulfiller | The token transfer completed and a receipt records the outcome. |

VINSS references the allocation. The current module has no dispute or refund choice.

Sources: [docs/ESCROW.md](ESCROW.md), [daml/Vinss/Deal.daml](../daml/Vinss/Deal.daml)

## 5. Why Canton

Private negotiation connects to an authorized business record.

**Content privacy**

OpenMLS encrypts chat and detailed offer terms in the browser.

Members decrypt and keep plaintext history locally.

**Deal authority**

Canton controls contract visibility. Daml assigns each deal action to a Party.

Token Standard Allocations provide the payment mechanism.

Authorized ledger viewers can see deal metadata, including amounts and Parties.

Sources: [docs/ARCHITECTURE.md](ARCHITECTURE.md), [docs/TECHNICAL_OVERVIEW.md](TECHNICAL_OVERVIEW.md)

## 6. Recorded technical progress

A real DevNet settlement and a separate local messaging suite.

| Evidence | Recorded result | Scope |
| --- | --- | --- |
| 6 Oct 2026 escrow | 1 CC transferred; receipt and receiver holding IDs retained | Real Canton DevNet run |
| 7 Oct 2026 test suite | 69 tests passed across 24 files | Local automated tests |
| Messaging integration | 10 test messages; Alice-Bob and three-member group | Real OpenMLS WASM; simulated ledger / wallet |

The updated browser-wallet messaging flow still needs a fresh live recording.

Sources: [docs/CANTON_DEVNET_E2E.md#verified-devnet-run-evidence](CANTON_DEVNET_E2E.md#verified-devnet-run-evidence), [docs/MESSAGING_E2E.md](MESSAGING_E2E.md)

## 7. The first users already have a client

Direct invitations make the product useful before marketplace scale.

**Initial cohort**

3-5 client-freelancer pairs.

One defined digital deliverable, a named reviewer and compatible Canton wallets.

**What the pilot must show**

Both people can join and complete the funded workflow.

They understand approval and choose to return for a second task.

Proposed audience and pilot. Customer demand and retention are not yet measured.

Sources: [docs/ICP_AUDIENCE.md](ICP_AUDIENCE.md), [docs/PILOT_PLAN.md](PILOT_PLAN.md)

## 8. A subscription for recurring work

Optional VIP is the proposed commercial model.

**Benefits to validate**

Reusable offer templates.
Deal activity exports.
More marketplace listings.

The buyer is a freelancer or small team managing repeat projects.

**How to test it**

Observe second deals and interview repeat users.

Identify the benefit they would pay for before setting a price or building billing.

VIP billing and Points issuance are pending. Private chat and escrow are core features.

Sources: [docs/GTM.md](GTM.md), [frontend/app/rewards/page.tsx](../frontend/app/rewards/page.tsx)

## 9. A pilot with measurable decisions

Recruit pairs, observe the first deal, then test repeat use.

| Proposed measure | Target for a small pilot | Decision |
| --- | --- | --- |
| Invite and deal completion | At least 80% of controlled attempts | Fix recurring failures before expanding. |
| Repeat use | At least 2 pairs start a second task within 14 days | Check whether the product solves a recurring need. |
| VIP interest | At least 2 repeat-user interviews identify willingness to pay | Choose a benefit for a pricing test. |

Targets are proposed, not achieved results. Report raw counts for the 3-5-pair cohort.

Sources: [docs/METRICS_VALIDATION.md](METRICS_VALIDATION.md), [docs/GTM.md](GTM.md)

## 10. The next Canton milestone

Complete the live wallet demonstration and the first observed pilot.

Record current-release chat and group delivery.
Verify the funded deal through its settlement receipt.
Use participant feedback to resolve the biggest blockers.

Next product decisions: recovery, dispute/refund handling, self-service listings and VIP. Multichain follows Canton.

Sources: [docs/PILOT_PLAN.md](PILOT_PLAN.md), [docs/SUBMISSION.md](SUBMISSION.md)

