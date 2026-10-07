# VINSS — technical overview

Code reference: Canton revision `2709b047ea6a53e74d3b894802d5c599d10759ff`. This document describes implementation and evidence boundaries; business hypotheses are in [GTM](GTM.md).

## Product boundary

VINSS connects private conversation, structured offers and two-party escrow settlement. Direct invites and Marketplace Jobs enter the same room workflow. Seven offer templates cover freelance work, token trades, physical goods, digital goods, bounties, NFT deals and custom deals. These are input structures, not proof that delivery verification and dispute handling exist for every category.

The private-deal concept continues from [VINSS on Starknet](https://github.com/DXJLabs/vinss). This Canton implementation uses different contracts, wallets and settlement mechanisms; features from the earlier implementation are not automatically present here.

## Components and responsibilities

| Component | Responsibility | Main source |
| --- | --- | --- |
| Next.js frontend | Wallet entry, rooms, invites, jobs, offers and deal UI. | [frontend](../frontend) |
| OpenMLS WASM | Group key state, authenticated membership and encrypted message content. | [OpenMLS provider](../src/messaging/openmls/provider.ts) |
| Canton transport | Publishes and reads encrypted message contracts with Party visibility. | [transport](../src/messaging/canton/transport.ts) |
| Local history | Stores readable messages on the user's device; distinct from encrypted MLS checkpoints. | [local storage](../src/messaging/local) |
| Daml deal module | Agreement, funded allocation reference, fulfillment, review and settlement receipt. | [Deal.daml](../daml/Vinss/Deal.daml) |

## Invite and group flow

An invite link or QR carries the conversation invitation. Joining requires a wallet-bound installation and a published KeyPackage; the creator resolves the peer binding and admits it into OpenMLS. This avoids asking ordinary users to enter Party and Installation IDs. The creator's original browser installation must be available for admission in the current flow.

Group messaging uses the same encryption foundation. The supplied tests exercise three members. A higher UI member limit is not a scalability result. Group escrow and multi-party offers are not implemented.

## What is private, and where

Message content and detailed offer content are encrypted in the browser. Canton receives encrypted message payloads, while authorized recipients decrypt and retain readable history locally. MLS checkpoints use encrypted local storage with a device key. This does not make the local plaintext history encrypted: device/browser access remains part of its security boundary.

The ledger still contains routing and business metadata. Authorized viewers can see fields such as Parties, amounts, hashes and deal status. OpenMLS content encryption and Canton's contract visibility are complementary; neither should be described as hiding all metadata.

## Escrow / rekber

1. A proposal is accepted into a `DealAgreement`.
2. The payer/reviewer authorizes a Token Standard Allocation. `FundEscrow` validates the reference against the expected instrument, amount, sender, receiver, executor and deal reference, then creates `DealEscrow`.
3. The fulfiller submits delivery. The reviewer approves or requests revision.
4. The fulfiller invokes `Settle`. The VINSS path executes `Allocation_ExecuteTransfer` and creates `SettlementReceipt` in the same Daml transaction.

An accepted offer is not funded escrow. Approval is not completed settlement. VINSS references a token allocation rather than collecting principal into an application-owned wallet. Behavior outside the VINSS path depends on the underlying token allocation implementation and its authorized choices.

The current module has no dispute-resolution or refund choice and does not automatically verify off-chain work quality. See [Escrow](ESCROW.md) for the contract explanation and [Architecture](ARCHITECTURE.md) for the full component model.

## Marketplace and future commercial features

The current marketplace reads a committed job catalogue, supports browsing/filtering and creates a room/offer draft for a valid listing. The current live catalogue is empty; demo jobs are sample data. Self-service publishing is not implemented.

Escrow fees, individual VIP, points and a possible airdrop are future plans. The agreed business plan is 0.5% escrow (USD 0.10 minimum), optional USD 3/month individual VIP with 2× qualifying points and a 20% escrow-rate discount. No billing or points issuance is implemented by this documentation update. Earlier UI preview ideas for other VIP benefits are not the agreed commercial plan. Multichain remains later work.

## Verification

| Evidence | Scope |
| --- | --- |
| Recorded 1 CC settlement on 6 October 2026 | One real Canton DevNet scenario, with receipt/update/holding references. |
| Developer-supplied 7 October output: 69 tests, 24 files passed | Local automated coverage, not user adoption or a security audit. |
| Ten-message direct/group integration | Real OpenMLS WASM, simulated ledger and wallet. |

A fresh browser-wallet recording of the current build remains outstanding. Historical settlement evidence and local messaging tests must not be combined into a claim that the latest entire UI flow has been retested live. Details: [DevNet evidence](CANTON_DEVNET_E2E.md), [messaging checks](MESSAGING_E2E.md), [validation status](METRICS_VALIDATION.md).
