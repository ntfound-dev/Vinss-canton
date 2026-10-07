# VINSS — business brief

**VINSS is a private deal workspace for clients and freelancers on Canton.** They discuss the work, agree on an offer, review delivery and settle an allocation-backed payment in one room.

## The problem and the customer

The initial audience is independent freelancers and small teams handling direct client work. They often negotiate in a messenger and track payment elsewhere. That makes it harder to tell whether the current scope, accepted offer and payment state still agree.

The first pilot should focus on bounded digital work such as design, development or writing: one client, one freelancer, one amount and a clear deliverable. This is a proposed target audience, not a claim of existing customers or market validation.

## The product

A client and freelancer can start directly with an invite link or QR. Neither needs to type a peer Party or Installation ID. A published marketplace job provides a second entry into the same private room and pre-fills an offer draft.

In the room, they exchange encrypted messages and detailed terms. The ledger records the agreement and funding reference. The freelancer submits work; the client approves or requests a revision. Approval lets the freelancer execute settlement and receive a ledger receipt.

Groups support private team conversations. The current escrow workflow remains between two Parties.

## Value for each side

| User | Value to validate in the pilot |
| --- | --- |
| Client | Review the agreed scope and delivery alongside the escrow status before approving payment |
| Freelancer | Check that the deal is funded and retain a settlement record for the completed work |
| Small team | Use encrypted group conversations while keeping individual client agreements separate |

The intended benefit is less context switching and clearer deal status. No reduction in disputes, conversion lift or user retention has been measured yet.

## Why Canton

Canton provides Party-based visibility and ledger-enforced authority for the business records. OpenMLS encrypts conversational content. The Token Standard Allocation supplies the escrow settlement rail. This combination lets VINSS keep detailed negotiation private while linking it to a verifiable agreement and receipt.

Amounts, Parties and contract metadata are not hidden from their authorized ledger viewers. Local message history is plaintext in the user's browser; it is not synchronized across devices.

## Who pays

The proposed customer for an optional VIP subscription is a freelancer or small team managing repeat work. The current membership preview proposes reusable offer templates, more listings and activity exports. Pricing, entitlements and billing are not implemented or validated.

Points are a separate planned rewards program; earning rules and rewards are undefined. VINSS currently issues no points or token and charges no VIP subscription. A transaction-fee model has not been established in this release.

## Initial go-to-market

Start by inviting a small cohort of freelance client pairs to complete one clearly scoped task. Proposed recruitment channels are freelancer communities and Canton builder/community contacts; there are no confirmed distribution partners or existing VINSS customer figures in this evidence.

Use completed workflows and participant interviews as the first case studies. Validate repeat use and willingness to pay before promoting VIP. Marketplace expansion follows a reliable direct-invite experience, rather than assuming a large job supply already exists.

## Evidence and next decision

The repository records a real **1 CC DevNet escrow settlement on 2026-10-06**. The current automated suite verifies private and group messaging with actual OpenMLS WASM over simulated ledger/wallet access. These establish technical progress, not paying-customer demand or a new live messaging run.

The next decision is whether a small group of client–freelancer pairs can complete the wallet-connected Canton flow reliably and find it useful enough to reuse. [Pilot plan](PILOT_PLAN.md) defines the checks; [Demo and evidence](SUBMISSION.md) shows what can be demonstrated today.
