# VINSS - Value / Problem Statement

**A private conversation should lead to a clear agreement.**

VINSS gives a client and freelancer one room to discuss work, agree on an offer, review delivery and settle payment on Canton.

## The problem

**Scope and payment drift apart..** The work is discussed in a messenger, the job lives on a marketplace, and payment has a separate status. Both people must reconcile those records when the scope changes.

**Each side needs clarity..** The client needs to review delivery against the agreed terms. The freelancer needs to see whether payment is funded and what remains before settlement.

## The product

**Join with a link or QR..** Each person connects a Canton wallet. VINSS resolves the signed peer installation and opens an MLS conversation without manual Party or Installation IDs.

**Make an offer in the conversation..** Detailed terms travel inside encrypted messages. Canton records the amount, asset, Parties, terms hash and agreement lifecycle.

**Connect delivery to settlement..** The payer funds a Token Standard Allocation. The freelancer submits work, the client approves or requests revision, and the freelancer settles after approval.

## Why Canton, why now

**A shared workflow with selective access..** Canton supplies Party-based contract visibility and Daml authorization. OpenMLS encrypts conversation content. Token Standard Allocations connect the agreement to the payment rail.

**Start with a bounded use case..** The current MVP brings these pieces together for direct client work. A small Canton pilot can now test whether people can complete and reuse the workflow.

## Current boundaries

Current scope: Canton, private deals and encrypted groups. Groups have no escrow UI. Dispute/refund handling and cross-device recovery remain unimplemented.

## Sources

- [BUSINESS_BRIEF.md](BUSINESS_BRIEF.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [daml/Vinss/Deal.daml](../daml/Vinss/Deal.daml)
- [frontend/lib/canton-room-runtime.ts](../frontend/lib/canton-room-runtime.ts)
