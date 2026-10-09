# Deal & Escrow (Rekber)

**Agree on the work, fund the allocation, review delivery, then settle payment.**

VINSS keeps the agreement and payment workflow in one two-person private room. Detailed work terms travel through encrypted messages. Canton records who agreed, the funding reference, delivery and review decisions, and the settlement receipt.

The complete contract workflow lives in [daml/Vinss/Deal.daml](../daml/Vinss/Deal.daml), under `Vinss.Deal`. It includes both offers and escrow. This guide includes the 2026-10-09 funding recovery changes.

## What rekber means here

The payer's wallet creates a Canton Token Standard Allocation for the agreed payment. VINSS checks that allocation and records its reference in `DealEscrow`. After delivery approval, the payee settles through the allocation's transfer choice.

VINSS does not hold funds in an application-controlled custodial account. The underlying token implementation controls the allocation and its available actions. The recorded DevNet settlement used Canton Coin (CC); another asset requires compatible registry support and authorization.

## Who does what

| Contract role | Responsibility |
| --- | --- |
| `seller` | Proposes the agreement; signs `DealProposal` |
| `buyer` | Accepts or rejects the proposal |
| `reviewer` | Pays, funds escrow, reviews delivery and approves or requests revision |
| `fulfiller` | Delivers the work, submits revisions and settles the approved payment |

`reviewer` and `fulfiller` must be different Parties drawn from `seller` and `buyer`. For a typical freelance deal, the client is the reviewer/payer and the freelancer is the fulfiller/payee. The explicit roles determine payment and delivery authority even when the proposer/accepter roles are swapped.

## From agreement to payment

1. **Agree on terms.** The proposer sends the offer. The accepter exercises `DealProposal.Accept` before expiry, creating `DealAgreement`.
2. **Fund escrow.** The payer's wallet creates an Allocation. The reviewer exercises `DealAgreement.FundEscrow` with its contract ID. Validation creates `DealEscrow`.
3. **Submit delivery.** The fulfiller exercises `DealEscrow.SubmitFundedFulfillment` with a fulfillment hash, creating `DealFulfillment`.
4. **Review the work.** The reviewer exercises `Approve`, creating `FulfillmentApproval`, or `RequestRevision`, creating `DealRevisionRequest`. The fulfiller can submit the next revision for review.
5. **Settle payment.** The fulfiller exercises `FulfillmentApproval.Settle` with registry-supplied context. It executes `Allocation_ExecuteTransfer` and creates `SettlementReceipt` with receiver holding references.

Acceptance and funding are separate wallet steps. If funding fails after acceptance, an agreement may exist while escrow remains unfunded. Approval and settlement are also separate: an approval permits the VINSS settlement action; the resulting receipt records its completion.

## Contract map

| Template | Meaning | Next choice and authorized actor |
| --- | --- | --- |
| `DealProposal` | Proposed terms hash, amount, asset, Parties and expiry | `Accept` or `Reject` — buyer |
| `DealAgreement` | Accepted agreement | `FundEscrow` — reviewer; `SubmitFulfillment` — fulfiller for a deal without escrow |
| `DealEscrow` | Funded agreement referencing a validated Allocation | `SubmitFundedFulfillment` — fulfiller |
| `DealFulfillment` | Submitted fulfillment hash and revision round | `Approve` or `RequestRevision` — reviewer |
| `DealRevisionRequest` | Review hash and previous delivery reference | `SubmitRevision` — fulfiller |
| `FulfillmentApproval` | Approved fulfillment and its allocation reference | `Settle` — fulfiller |
| `SettlementReceipt` | Settled amount, asset, delivery hash, revision round, receiver holding IDs and time | No further choice in this module |

These are successive contracts in one workflow. A room message reporting a deal action does not replace the authorized Daml choice.

## What funding validates

`FundEscrow` fetches the referenced Allocation and checks the following fields before creating `DealEscrow`:

| Allocation field | Required match |
| --- | --- |
| Instrument admin | Agreed `instrumentAdmin` |
| Instrument ID | Agreed `instrumentId` |
| Transfer amount | Deal amount parsed as a decimal |
| Settlement reference ID | `dealId` |
| Sender | Reviewer/payer |
| Receiver | Fulfiller/payee |
| Settlement executor | Fulfiller/payee |

`FundEscrow` validates an existing Allocation; it does not create the token lock itself. The allocation must remain usable under the token registry's rules when settlement executes. Network-specific registry configuration and wallet authorization are required.

A proposal without `instrumentAdmin` follows the original agreement/delivery path. It has no allocation-backed Canton escrow to settle. For escrow-enabled agreements, direct `SubmitFulfillment` is blocked until funding; delivery proceeds through `DealEscrow`.

## Private content and ledger records

Detailed offer terms are MLS-encrypted in the conversation; the proposal records their hash. Delivery and revision choices record hashes rather than the full work or review text. Message plaintext is saved in the member's local browser history; message contracts carry ciphertext.

Deal records contain visible business metadata, including Parties, amount, asset and lifecycle references, according to each contract's signatories and observers. Content encryption does not hide that metadata. See [Architecture](ARCHITECTURE.md) for storage and visibility boundaries.

## Evidence

- [Recorded DevNet settlement](CANTON_DEVNET_E2E.md#verified-devnet-run-evidence): an earlier real **1 CC settlement on 2026-10-06**, with transaction and receipt IDs.
- [Escrow provider tests](../tests/canton-escrow-provider.test.ts): local checks of provider submissions and escrow choices using ledger fixtures.
- [Demo walkthrough](SUBMISSION.md): the two-wallet recording flow, including separate funding and settlement checks.

The historical DevNet receipt establishes that recorded run. Local fixture tests and messaging simulation do not establish a fresh live settlement of every release.

## Current limits

The module has no dispute, arbitration or refund choice. It does not implement timeout refunds or group escrow. Revision requests retain the allocation reference and return the work to review; they do not refund payment. Any cancellation or other action exposed by the underlying Allocation belongs to the token implementation and is not a VINSS dispute flow.

The VINSS `Settle` path requires approved fulfillment. This is a statement about VINSS's contract workflow, not a guarantee about every action available on the external Allocation. Settlement can still fail if registry context, authorization or the allocation state is invalid.

## Code entry points

| Layer | Source |
| --- | --- |
| Daml authority and lifecycle | [Deal.daml — Deal & Escrow (Rekber)](../daml/Vinss/Deal.daml) |
| Stable template identifiers | [deal-templates.ts](../src/canton/deal-templates.ts) |
| Ledger choices, including escrow | [http-offer-provider.ts](../src/canton/http-offer-provider.ts) |
| Allocation funding and registry settlement context | [token-wallet.ts](../src/canton/token-wallet.ts) |
| Wallet-connected room actions | [canton-room-runtime.ts](../frontend/lib/canton-room-runtime.ts) |

The provider's existing filename includes `offer`, but its implementation handles agreement, escrow, fulfillment, review and settlement as well.

## Funding recovery

If acceptance succeeds but funding fails, the ledger retains `DealAgreement`. Room history is hydrated from active contracts after ledger updates and refresh. The payer can press **Retry escrow funding**. Runtime first resolves the active agreement and checks its recorded terms against the encrypted offer; it does not exercise the archived proposal again.

Before allocating new holdings, the token wallet queries existing allocations and reuses a live allocation matching deal ID, sender, receiver, executor, instrument/admin, exact decimal amount and settlement deadline. `FundEscrow` still validates the allocation on-ledger. Rejected/expired/wrong-party allocations are not accepted for recovery. This avoids locking a second allocation after the first succeeded and funding failed. Pending or concurrent submissions still require ledger reconciliation; this is not a general transaction outbox or concurrency guarantee.

The UI blocks work submission before funded escrow is confirmed. The same `onAccept` action handles funding retry; acceptance, funding and the encrypted action notification remain separate transactions. Check live contract state after any timeout.

### cBTC verification boundary

Network admin/registrar defaults are in `frontend/lib/canton-room-runtime.ts`; token allocation is instrument-specific. No silent CC substitution exists in this patch. The configured DevNet/TestNet/MainNet admin Parties and utility base URLs match the official [BitSafe cbtc-lib network configuration](https://github.com/DLC-link/cbtc-lib#environment-specific-values), checked on 2026-10-09. They were not independently queried on-network here. Live validation must confirm the registrar, unlocked CBTC holdings, allocation and receipt with the same admin/asset on the intended network. The historical Amulet receipt is CC evidence only. See [Testing](TESTING.md) and [DevNet evidence](CANTON_DEVNET_E2E.md).

Test cBTC is available through the official [BitSafe faucet](https://cbtc-faucet.bitsafe.finance/), subject to availability and recipient acceptance. The recipient participant requires the DA Utility Registry. Faucet receipt is a separate transfer and is not evidence of escrow settlement.
