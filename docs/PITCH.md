# VINSS — pitch notes

[Open the pitch deck](vinss-deck.pdf). This is a 13-slide PDF, including one evidence appendix. It is the only PDF required for this submission.

## Slide 1. VINSS — a private deal room

VINSS is a private deal room. The product links an agreement to fulfillment and settlement rather than treating payment as a disconnected transfer.

## Slide 2. The agreement is in chat. The payment is somewhere else.

Consider a buyer arranging a small design task through direct messages. Paying first exposes the buyer; delivering first exposes the seller. The root problem is a disconnected agreement and completion process. This is an illustrative scenario, not an interview quotation.

## Slide 3. Start with a small digital deal between two wallet users.

Recruit independent buyers and sellers arranging clearly scoped digital services with a new counterparty. A code or design deliverable has an observable output and a short completion cycle. VINSS is broader than a freelance marketplace; this is the first segment to validate.

## Slide 4. Bring the counterparty. Keep the deal in one room.

A private invitation admits the wallet-bound participant into the encrypted room. An offer establishes the agreement; allocation funding, delivery review and settlement then refer to that deal. Groups support conversation; the current escrow path is two-party.

## Slide 5. Private context. A shared, authorized outcome.

OpenMLS encrypts message content in the browser. Canton controls contract visibility and which Party may act. Daml couples the VINSS settlement action to allocation transfer and receipt creation. Available wallet and token-standard infrastructure makes this integration testable now; it is not a claim that escrow was previously impossible.

## Slide 6. A private workflow for deals people already arrange directly.

The initial comparison is against the workflow people use, not a claim that no competitor has escrow. Existing marketplaces can combine many capabilities, but users join their marketplace rules and relationship. VINSS tests whether a portable private room is a useful alternative. A database could implement coordination, with the operator as record authority.

## Slide 7. Charge for escrow. Keep core deal actions free.

Proposed regular escrow pricing is 0.5% with a USD 0.10 minimum. The payer would pay. Optional individual VIP is USD 3 per month for 2x qualifying points and 20% off the escrow rate: 0.4%, same minimum. No billing is implemented. Network costs are separate; points have no guaranteed token value. Pricing requires cost and willingness-to-pay validation.

## Slide 8. A working foundation. Customer validation comes next.

One historical real Canton DevNet settlement transferred 1 CC on 6 October 2026. Separately, developer-supplied logs on 7 October report 69 tests in 24 files passing and ten local integration messages across direct and three-member group scenarios. The local integration uses real OpenMLS WASM and simulated wallet/ledger. No customer traction or new live browser run is claimed.

## Slide 9. Recruit pairs, then test whether the second deal happens.

Ask community organizers for introductions to suitable pairs. Approach the HackCanton community, DevWeb3Jogja and Blockchain Pioneer Student Club; these are unconfirmed outreach candidates. Each first participant can invite their existing counterparty. Observe joining, completion and unprompted repeat demand before adding reward incentives.

## Slide 10. Measure completed deals, not message counts.

The proposed North Star is genuine buyer–seller deals settled per week. Count distinct deal IDs with receipts and a consented pilot record; exclude tests and self-dealing. No documented customer interviews or product conversion numbers have been supplied. First collect the baseline, observe five pairs, then test repeat use and willingness to pay.

## Slide 11. Prove Canton first. Expand to multiple chains later.

Over the next 90 days, the proposed work is customer discovery, an observed Canton pilot and pricing/cost validation. Improve reliability and resolve settlement/recovery limitations before broader payment use. Multichain is a later direction selected from user demand; it requires chain-specific wallet, privacy and settlement integration. Neither bridging nor atomic cross-chain settlement is implemented.

## Slide 12. Help us validate the next five private deals.

VINSS has an original Starknet product foundation and an inspectable Canton implementation, showing continuity of the product idea. We are seeking five pilot pairs, wallet/validator support and a review of settlement/recovery behavior. The next milestone is evidence that people complete and repeat the workflow. No funding amount, customer or partner commitment is claimed.

## Slide 13. Inspect the implementation and the business hypotheses.

Code reviewed at Canton revision 2709b047ea6a53e74d3b894802d5c599d10759ff. The revised business materials are supplied in the documentation package. The customer profile, acquisition plan, pilot thresholds and prices are hypotheses; no invented interviews or market-size figures are used.

## Short demo recording sequence

This is a recording guide, not evidence that the latest live browser flow has passed. Use two independent browser profiles/wallets for the direct deal; use a third for the separate group demonstration. Do not expose authentication secrets on screen.

| Approximate time | Show | Say |
| --- | --- | --- |
| 0:00–0:20 | Home and connected wallet | “VINSS brings a private agreement and its payment workflow into one deal room.” |
| 0:20–0:50 | Alice creates an invite; Bob opens the link or scans the QR | “Bring your existing counterparty without entering manual peer IDs.” Keep the creator available for admission. |
| 0:50–1:15 | Both users send a message; reload and show local history | “Messages use OpenMLS encryption. Readable history stays on this device.” |
| 1:15–1:50 | Create, review and accept a concrete offer | “Both sides can see the agreed scope and amount.” |
| 1:50–2:30 | Fund, submit delivery, approve and settle | Show each real wallet action and the final receipt. Keep enough footage to distinguish accepted, funded, approved and settled. |
| 2:30–2:50 | A separate three-person group | “Encrypted group chat is supported; escrow currently uses two-person rooms.” |
| 2:50–3:10 | Closing view | “Next we validate real user demand. Escrow fees, individual VIP and multichain are later plans.” |

Timing is a guide. Preserve the real transaction sequence if confirmations take longer. If a step fails, fix or disclose it rather than replacing it with a simulated success. Sample jobs and the demo route are previews, not real token-transfer evidence. Verify the published video and live app are accessible to judges, then add the video URL to SUBMISSION_FORM.md.
