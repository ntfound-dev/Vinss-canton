# VINSS Canton Architecture

## Trust boundaries

### Browser
Trusted with plaintext and MLS private state.

Responsibilities:
- create device/installation identity
- generate MLS KeyPackages
- process Welcome + Commit messages
- encrypt outgoing application messages
- decrypt incoming application messages
- keep MLS group state encrypted at rest

### VINSS Relay
Untrusted for message confidentiality.

Allowed:
- ciphertext
- public delivery metadata
- KeyPackages
- MLS handshake payloads
- cursors / sequencing
- attachment ciphertext

Forbidden:
- plaintext
- MLS private key material
- exported unencrypted group state

### Canton
Canonical business state only.

Examples:
- DealProposal
- DealAgreement
- fulfillment proof/hash
- dispute state
- allocation/funding references
- settlement
- receipt

Do not write casual chat messages to Canton.

## Escrow (Canton settlement rail)

A deal uses Canton escrow when its proposal names a `custodian`. Deals without
one keep the original flow and have nothing to settle on Canton.

```text
DealProposal --Accept--> DealAgreement --FundEscrow--> DealEscrow
                                                          |
                                             SubmitFundedFulfillment
                                                          v
                        RequestRevision <--- DealFulfillment ---Approve---> FulfillmentApproval
                        (DealRevisionRequest --SubmitRevision--^)                   |
                                                                                  Settle
                                                                                    v
                                                                          SettlementReceipt
```

Roles and money flow:
- The reviewer (who approves the work) is the payer and the fulfiller (who
  delivers it) is the payee. With the default roles this is buyer -> seller and
  it stays correct for swapped roles such as freelance offers.
- The custodian holds the backing value off-ledger and is neither party.
  It issues a `CashHolding` (an on-ledger acknowledgement, `Vinss.Custody`) to
  the payer. The amount and instrument must match the deal exactly; holdings are
  per-deal deposits, there is no split or merge.
- `FundEscrow` locks that holding into a `LockedHolding` and creates the
  `DealEscrow` in one transaction, so a deal is funded if and only if the
  holding is locked.
- `Settle` is claimed by the payee after approval. The release needs both the
  payer's and the payee's authority: the payer's comes from having signed the
  `FulfillmentApproval`, so funds can only move through an approved
  fulfillment. Neither party can release alone.

Privacy:
- The custodian only sees holdings (payer, payee, amount, instrument, deal id).
  It does not see deal terms hashes, fulfillment hashes or conversation ids.
- Work details and chat stay in OpenMLS; Canton only carries hashes and state.

Trust model and known gaps:
- Holdings are custodian IOUs. As signatory the custodian can always archive
  its own contracts, so both parties must agree on the custodian in the
  proposal, and the custodian must really hold the backing value.
- There is no on-ledger refund, dispute or fulfillment deadline yet. Funds stay
  locked until the payer approves; anything else is a custodian decision made
  off-ledger. This needs a product decision before real funds are used.
- `DealFulfillment`, `DealRevisionRequest` and `FulfillmentApproval` are still
  signed by a single party, as before. Co-signing them (seller and buyer) would
  guarantee they can only be created through the workflow.
- The UI does not use escrow yet: it never sets `custodian`, so deals created
  from the frontend keep the original flow.

## Group lifecycle

```text
installation creates KeyPackage
          |
          v
creator creates MLS group (epoch N)
          |
          +---- Add member --> Commit + Welcome --> epoch N+1
          |
          +---- Remove member --> Commit ----------> epoch N+2
          |
          +---- application message encrypted under current epoch
```

## Typed content

VINSS messages are application payloads encrypted by MLS.

Generic:
- text
- reply
- reaction
- read receipt
- attachment reference

VINSS-specific:
- deal proposal
- deal action

`deal_action` is not itself ledger authorization. The UI must still require the user to authorize the Canton transaction.

## Identity

Do not reuse Canton signing keys as MLS encryption/signing identity by default.

Maintain explicit mapping:

```text
VINSS User
  |- Canton Party ID
  `- Messaging installations[]
```

This prevents one cryptographic domain from accidentally becoming a universal key.
