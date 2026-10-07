# VINSS — pilot plan

The immediate goal is a reliable client–freelancer workflow on Canton. The sequence below is proposed work; participants, commercial demand and production readiness have not been established.

## 1. Verify the current release with separate wallets

Run Alice–Bob invitation, QR join, messaging, history reload and the funded delivery/approval/settlement lifecycle. Run a separate three-person group conversation and check ledger visibility using isolated users.

**Dependencies:** compatible Canton wallets, authorized participant access, deployed/vetted messaging and deal templates, the selected network's token registry, and a test-token balance.

**Exit evidence:** dated network and release identifiers; actual messaging and settlement updates; the receipt and receiver Holding references; confirmation that an unrelated Party cannot query private message contracts. Capture wallet authorization failures rather than counting them as successful steps.

## 2. Validate a small freelance pilot

Recruit a proposed starting cohort of 3–5 client–freelancer pairs with bounded digital tasks. Observe invitation join, offer clarity, funding, delivery review and repeat use. Begin with a controlled test-token exercise; real payment use requires a defined response to failed funding, incomplete delivery and disputes.

**Dependencies:** consent from participants, a clear support contact, agreed deliverables, usable wallet onboarding and a storage/recovery explanation.

**Measure:** invite-to-room success, completed workflows versus attempted workflows, wallet/network failure counts, time to agree and settle, repeat use and interview feedback. These are proposed metrics, not results already achieved.

**Decision:** fix the largest repeated failure before expanding the cohort. The current contract has no dispute/refund choice, so this gap needs an explicit product and contract decision before broader real-payment use.

## 3. Expand the validated Canton experience

Build self-service listing publication with ownership checks and listing management; the current marketplace reads a committed dataset. Add recovery and reliability work based on pilot failures, including cross-device needs and safe coordination of MLS state.

Validate willingness to pay before implementing optional VIP billing, entitlements and pricing. Define the purpose and earning rules for Points before issuing rewards. Keep chat and escrow as the core workflow described in the current product.

**Dependencies:** persistent listing storage, authenticated publishing, a billing/entitlement design, and privacy-preserving support diagnostics. Neither VIP payments nor Points issuance exists today.

Multichain is a later phase. It needs a separate design for wallet identity, message delivery and settlement per network; additional chains are not part of the current Canton pilot.
