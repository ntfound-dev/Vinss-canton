# Value — VINSS

## 1. The problem in one sentence

Independent buyers and sellers arranging digital work through private messages struggle to exchange payment and delivery with a new counterparty because their conversation, final terms and payment records are disconnected, leaving one person to pay or deliver first without a shared process for completing the deal.

Our initial focus is a small, clearly scoped digital task between two crypto wallet users. This is an entry segment for VINSS, not the limit of the product.

## 2. The value we create

| | Today: direct messages and a separate wallet | With VINSS |
| --- | --- | --- |
| What the user does | Negotiates in chat, finds the final terms among messages, sends a transfer and exchanges delivery/payment screenshots. | Invites the counterparty into a private room, accepts an offer, funds an allocation, submits delivery, reviews it and settles against the agreement. |
| Time / cost / risk | Repeated checking; uncertainty about the accepted scope and whether payment is ready; a transfer alone does not establish that delivery was approved. | Both people can follow the same agreement and payment states. In the VINSS settlement path, approval precedes execution of the referenced payment allocation. |

**Value proposition:** VINSS connects private conversation, agreed terms and escrow settlement in one deal room.

**Why switch:** people can bring an existing counterparty through an invite link or QR, without first moving their relationship into a new public marketplace. The reason to return should be a clearer, completed deal—not a reward for sending more messages.

VINSS does not guarantee the quality of off-chain work. The current Canton contract has no dispute-resolution or refund choice; this limits the kinds of deals suitable for an early pilot.

## 3. Why it matters

The conflict affects both sides. A buyer wants evidence before paying. A seller wants payment assurance before releasing work. A vague agreement increases the chance that they disagree about what counts as completion.

The money at risk depends on the deal amount; the coordination cost depends on time spent finding terms, confirming funding and chasing approval. We have not yet measured those costs with customers. We will ask pilot users to walk through their last direct deal and record these steps before comparing VINSS.

**Evidence and its limits:** the FTC explains that cryptocurrency payments are generally difficult to reverse and that public blockchain transactions may expose payment information. This supports the importance of payment context and privacy, but does not establish demand for VINSS or quantify losses in our initial segment. Our existing product and technical tests establish feasibility, not customer validation.

**How many people have this problem:** no defensible market-size estimate has been established. The first validation cohort is a proposed five buyer–seller pairs. It is a recruitment target, not a market-size claim.

## 4. Why now

Canton wallet connectivity, programmable Daml workflows and Token Standard Allocations give us components for connecting a private agreement to an authorized payment action. VINSS has already recorded one 1 CC DevNet settlement through that path.

Chat, escrow services and payment applications existed before VINSS. Our opportunity is to combine negotiation and settlement without requiring a public negotiation record or a separate manual intermediary. Whether this combination is worth switching for remains a pilot question.

## 5. Why Canton

Canton provides selective contract visibility and Party-authorized actions for the shared business record. Daml connects the VINSS settlement action to execution of a Token Standard Allocation and creation of a settlement receipt in the same transaction. OpenMLS separately encrypts conversation content in the browser; recipients keep readable history locally.

A database could coordinate the interface, but the operator would remain the source of truth for the deal state and would need a separate settlement integration. A public chain can implement escrow, but confidential negotiation and selective business-record visibility require additional design. Canton fits this product because privacy, authorization and asset workflows can work together.

This is not complete anonymity: authorized ledger viewers can see deal metadata such as Parties, amounts and status. VINSS currently focuses on Canton; multichain support is a later direction.

### Sources

- [FTC: cryptocurrency payments and scams](https://consumer.ftc.gov/articles/what-know-about-cryptocurrency-scams) — background evidence, not VINSS customer research.
- [Canton protocol](https://www.canton.network/protocol) — selective disclosure and transaction model.
- [VINSS escrow implementation](https://github.com/ntfound-dev/Vinss-canton/blob/2709b047ea6a53e74d3b894802d5c599d10759ff/daml/Vinss/Deal.daml), [escrow explanation](https://github.com/ntfound-dev/Vinss-canton/blob/2709b047ea6a53e74d3b894802d5c599d10759ff/docs/ESCROW.md), and [recorded DevNet run](https://github.com/ntfound-dev/Vinss-canton/blob/2709b047ea6a53e74d3b894802d5c599d10759ff/docs/CANTON_DEVNET_E2E.md).
- [Original VINSS product foundation](https://github.com/DXJLabs/vinss/tree/main/docs/product) — product continuity; Canton implementation is documented in this repository.
