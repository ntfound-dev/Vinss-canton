# VINSS — business brief

VINSS is a private deal room for people who agree and transact directly. It connects conversation, an accepted offer, delivery review and escrow settlement so both participants can follow the same deal.

## The opportunity

A private conversation is convenient for negotiation, but a separate payment does not show which scope was accepted or whether delivery was approved. Buyers and sellers must reconstruct that context through messages and screenshots, or move the transaction into a marketplace or a trusted middleman's process.

VINSS lets a participant bring an existing counterparty through an invite link or QR. Marketplace Jobs is a second entry point into the same workflow. The initial customer hypothesis is two crypto wallet users arranging a small, clearly scoped digital service with a new counterparty. The broader product supports private deals; it is not limited to freelance job discovery.

## Product and implementation

The original [VINSS project](https://github.com/DXJLabs/vinss/tree/main/docs) established the private-deal concept. This repository implements the Canton version. Features or dispute mechanisms from the Starknet implementation must not be assumed to exist here.

Canton provides Party-authorized business records and token allocation settlement. OpenMLS encrypts conversation content; plaintext history remains on the local device. Direct-room offers progress through agreement, allocation funding, fulfillment, approval/revision and settlement. Group chat is implemented; group escrow is not.

The MVP includes several offer templates and a marketplace-to-room entry flow. The committed public job catalogue is empty, and self-service listing publication is not implemented. Current Canton contracts do not provide dispute or refund choices. These limitations shape the initial pilot.

## Commercial plan — coming soon

Only escrow/rekber would incur a VINSS transaction fee: **0.5%, minimum USD 0.10**, proposed to be paid by the payer. Core room, chat and deal actions would have no separate VINSS application fee.

Optional **individual VIP at USD 3/month** would provide **2× qualifying points** and **20% off the escrow rate**, reducing it to **0.4%**, with the same minimum. No additional paid template, export or listing entitlement is proposed. Points and VIP are not active; a possible VINSS airdrop is deferred and no conversion or allocation is promised.

These are pricing hypotheses. Network costs, collection mechanics, supported payment assets and anti-abuse policy must be measured or defined before charging. [GTM](GTM.md) contains the unit-economics example and tests.

## Direction after Canton

VINSS is intended to expand to multiple chains after the Canton experience is validated. Expansion should bring the same private-deal experience to the networks users need, with separately verified wallet, privacy and settlement integrations. The existing Starknet project is a separate implementation; neither a unified multichain app nor cross-chain settlement is claimed today. No next chain or release date is committed in this submission.

## Evidence and next decision

The repository records a 1 CC DevNet settlement on 6 October 2026. The supplied 7 October local test output reports 69 passing tests across 24 files, including QR and messaging scenarios. Local messaging integration uses real OpenMLS WASM with a simulated ledger and wallet.

There is no supplied evidence of paying customers, customer interviews or measured adoption. The next decision is whether five recruited buyer–seller pairs can complete the workflow, find it useful and ask to repeat it. Product validation must precede claims about demand or sustainable revenue.

See [Value](VALUE_STATEMENT.md), [ICP](ICP_AUDIENCE.md), [Metrics](METRICS_VALIDATION.md) and [GTM](GTM.md) for the submission materials.
