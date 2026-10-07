# VINSS - Mvp / Technical Overview

**Private content, authorized ledger actions.**

The browser runs OpenMLS and the Canton dApp wallet SDK. Canton stores messaging ciphertext and signed business records. A token Allocation supplies the escrow settlement rail.

## Invitation and messaging

**Wallet binding.** A link or QR carries the invitation descriptor. The guest signs a KeyPackageRequest and publishes a KeyPackage. The creator resolves the Party/installation binding before MLS admission.

**Delivery.** KeyPackageOffer supplies public MLS material. MlsDelivery carries Welcome/Commit. EncryptedMessage carries application ciphertext and envelope metadata. The Canton path processes events in ledger order.

**Groups.** The creator admits wallet-bound guests with MLS Welcome/Commit and encrypted membership state. The UI limits groups to 32 members and one installation per Party.

## Storage and privacy

**Local browser.** IndexedDB keeps sent/decrypted history as plaintext, scoped by network, Party and installation. MLS checkpoints are separately encrypted at rest using a non-exportable device key.

**Ledger visibility.** The sender and designated recipients can see message contracts. Authorized infrastructure can see ciphertext and metadata. Deal viewers see amounts, assets, Parties and lifecycle records.

**Recovery boundary.** Clearing browser storage removes local history and keys. History and checkpoint writes are not atomic. There is no cross-device history or cross-tab MLS write lock.

## Offer, review and settlement

**Business authority.** DealProposal creates DealAgreement on acceptance. FundEscrow validates the referenced Allocation. The fulfiller submits funded work, the reviewer approves or requests revision, and the fulfiller exercises Settle.

**Token execution.** Settle exercises Allocation_ExecuteTransfer and records a SettlementReceipt with receiver holding references. VINSS references the allocation rather than custodying funds.

## Current boundaries

Acceptance and allocation/funding are separate wallet steps. No dispute/refund choice or group escrow is implemented. Sample jobs and /demo are simulated previews.

## Sources

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [daml/Vinss/Messaging.daml](../daml/Vinss/Messaging.daml)
- [daml/Vinss/Deal.daml](../daml/Vinss/Deal.daml)
- [src/messaging/local/plaintext-store.ts](../src/messaging/local/plaintext-store.ts)
