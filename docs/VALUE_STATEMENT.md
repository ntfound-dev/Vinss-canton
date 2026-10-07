# VINSS - Value / Problem Statement

## Private chat with a payment workflow

VINSS helps two people agree on digital work, fund escrow and settle payment after delivery approval in the same private room.

## The problem: the agreement gets separated from the payment

A client hires a freelancer through a community or personal contact. They negotiate in chat, send a payment elsewhere and review the work in another thread. When the scope changes, neither person has one place that shows the accepted terms, funding status and delivery decision.

The freelancer needs to know that the agreed payment is funded before delivering. The client needs to review the work against the accepted offer before approving settlement. A payment receipt alone does not explain what work both people agreed to.

## The product: a private room for the whole deal

One person creates an invite link or QR. The other connects a Canton wallet and joins. They discuss the work privately, create an offer and record acceptance. The client funds escrow, the freelancer submits delivery, and the client approves or requests a revision. After approval, the freelancer settles the payment and receives a ledger receipt.

| For the client | For the freelancer |
| --- | --- |
| Read the agreed scope beside the delivery and approve the work explicitly. | See whether escrow is funded and what action is needed to complete payment. |
| Keep private work discussions in the room. | Keep the accepted offer and settlement record connected to the conversation. |

## Initial use case

A client and freelancer completing one defined digital task. The product also supports encrypted group chat. The current escrow flow is between two people.

## How a design job becomes a settled deal

Illustrative example: a client commissions one landing-page design. This example explains the workflow; it is not a reported customer transaction.

| Step | What the people do | What VINSS records |
| --- | --- | --- |
| 1. Invite | The designer shares a private link or QR with the client. | A wallet-bound private room. |
| 2. Agree | They define the deliverable, price and review terms. The client accepts. | Private terms in encrypted chat and an accepted agreement on Canton. |
| 3. Fund | The client authorizes an allocation for the agreed payment. | A validated escrow reference. Acceptance alone does not prove funding. |
| 4. Review | The designer submits work. The client approves or requests revision. | Delivery and review hashes with the authorized decision. |
| 5. Settle | After approval, the designer executes settlement. | A receipt referencing the receiver token holdings. |

## Why Canton is part of the product

Canton gives the business record named participants, controlled visibility and actions enforced by Daml contracts. OpenMLS encrypts the conversation before messages reach the ledger. Token Standard Allocations connect the accepted agreement to the payment. Together, these support private negotiation with a shared record of who approved each deal action.

## The value to validate next

The pilot will test whether clients and freelancers can complete this workflow with less manual reconciliation and choose to use it for a second task. The existing evidence establishes software progress. Customer demand and repeat use still need measurement.

## Payment boundary

VINSS references the token allocation rather than holding funds in an application wallet. The current module has no dispute, arbitration or refund choice. Broader real-payment use requires that product decision.

## Sources

- [Product and business](BUSINESS_BRIEF.md)
- [Escrow roles and contract lifecycle](ESCROW.md)
- [Privacy and storage boundaries](ARCHITECTURE.md)
