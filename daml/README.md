# VINSS smart contracts

VINSS has two Daml modules: one for encrypted messaging and one for the complete **Deal & Escrow (Rekber)** workflow.

| Module | File | Responsibility |
| --- | --- | --- |
| `Vinss.Messaging` | [Messaging.daml](Vinss/Messaging.daml) | Wallet-bound installation registration, KeyPackage exchange, MLS delivery and encrypted message contracts |
| `Vinss.Deal` | [Deal.daml — Deal & Escrow (Rekber)](Vinss/Deal.daml) | Offers, agreements, allocation-backed escrow, fulfillment, revisions, approval and settlement receipts |

The escrow contracts are in `Deal.daml`. Start with [Deal & Escrow (Rekber)](../docs/ESCROW.md) for the roles, contract map, funding checks and payment flow.

`daml.yaml` sets `source: daml`. The `Vinss/` directory matches the `Vinss.*` module namespace. The frontend and ledger client use that namespace in their template identifiers, so file paths and module declarations must stay aligned.
