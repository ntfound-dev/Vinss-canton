# VINSS · Canton

**A private deal room connecting conversation, agreed terms and escrow settlement.**

VINSS brings two people into one private room to negotiate, agree on an offer, fund escrow, review delivery and settle payment on Canton. Join through an invitation link or QR, or start from a published marketplace job. Small digital-service deals are the initial validation segment; the product is a broader private transaction workspace.

[Open the app](https://vinss-canton.vercel.app) · [Pitch deck](docs/vinss-deck.pdf) · [Submission materials](docs/README.md) · [Demo and evidence](docs/SUBMISSION.md)

**HackCanton DevNet login now has a browser route.** Choose **HackCanton DevNet**, sign in with your own HackCanton account, and select an authorized Party. The server verifies the ledger user and `CanActAs` rights and requires explicit in-app approval for each transaction. This uses the NODERS hosted sandbox Party and HTTP Ledger API, not external wallet signing. Configure the server session key before deploying. Real account login and two-user acceptance still need verification. Grofty and the Canton SDK/gateway/WalletConnect routes remain available on compatible networks; Send Connect is excluded on DevNet. See [Wallet setup](docs/WALLET_SETUP.md).

## The problem

People arranging a direct deal with a new counterparty must decide who pays or delivers first. Their conversation, final terms and payment records live in different places. Messages and transfer screenshots do not provide a shared process for completing the agreement.

VINSS puts the conversation, offer and delivery decisions together. Private terms travel through encrypted messages; Canton records agreement and settlement state. The client can approve the delivery before the freelancer settles the funded allocation.

## See the workflow

Use two separate browser profiles and compatible Canton wallets on the same network. The connected wallets need ledger authorization; escrow also needs a supported token registry and payer balance.

1. **Invite:** Alice creates a Private deal invite and shares its link or downloadable QR. Bob opens it and connects his wallet. Keep Alice's original invite page open while the peer resolves.
2. **Discuss:** send messages in both directions. Reload each room to see its own locally saved history.
3. **Agree:** create an offer with the amount, asset, work terms and Client/Freelancer roles. The other person accepts. Verify funding separately: an accepted agreement alone does not prove escrow is funded.
4. **Deliver and settle:** the freelancer submits work; the client approves or requests a revision. After approval, the freelancer settles and the ledger produces a `SettlementReceipt`.
5. **Show group messaging separately:** create a Group chat invite, keep the creator's group open, admit Bob and Charlie and send from all three accounts. Groups currently support messaging; offers and escrow use two-person rooms.

The [pitch notes and recording guide](docs/PITCH.md) explain what to demonstrate; [submission evidence](docs/SUBMISSION.md) separates implemented behavior from verification. The `/demo` route and sample jobs are explicitly simulated previews; use a wallet-connected room to demonstrate real transactions.

## Why Canton

VINSS combines **MLS content encryption** with **Canton contract visibility and authorization**. Participants can discuss private terms while the ledger records the business workflow and its permitted actors.

| Layer | VINSS uses it for |
| --- | --- |
| OpenMLS in the browser | Encrypting private messages, offer terms and group membership content |
| Canton messaging contracts | Signed installation binding, KeyPackage exchange and ciphertext delivery to designated Parties |
| Daml deal contracts | Agreement, funding reference, delivery, review and settlement authorization |
| Canton Token Standard (CIP-56) | Allocation-backed escrow and transfer execution after approval |

VINSS references a token Allocation rather than holding funds in an application-controlled custodial wallet. Settlement depends on the allocation, token registry and authorized wallet actions.

## Who sees what

| Data | Where it lives and who can read it |
| --- | --- |
| Message text, detailed offer terms and private work content | Encrypted in transit; decrypted by room members and saved as plaintext in their local browser IndexedDB |
| Message ciphertext and envelope metadata | Canton `EncryptedMessage`; visible to the sender, designated recipients and authorized infrastructure |
| MLS keys and group checkpoints | Local browser IndexedDB, encrypted at rest with a non-exportable device key |
| Amount, asset, Parties, terms hash and deal status | Canton deal contracts, according to their signatory/observer roles |

Content encryption does not hide ledger metadata. Local plaintext history is not a cloud backup: clearing site storage removes history and keys, and another device does not inherit them. Full boundaries are in [Architecture](docs/ARCHITECTURE.md).

## Implementation and evidence

| Component | Current status | Evidence |
| --- | --- | --- |
| Wallet-bound private invitations and QR | Implemented; exact URL/secret round-trip tested | `InvitePanel`, `InviteQr`, QR tests |
| Alice–Bob messaging and three-member groups | Real OpenMLS WASM; verified with a simulated ledger/wallet in the latest automated suite | [Messaging verification](docs/MESSAGING_E2E.md) |
| Local message history and encrypted MLS checkpoints | Implemented; reload and replay checks passed | IndexedDB and runtime tests |
| Offer, delivery, approval and escrow settlement | Implemented; an earlier real DevNet run settled **1 CC on 2026-10-06** | [Recorded transaction and receipt IDs](docs/CANTON_DEVNET_E2E.md#verified-devnet-run-evidence) |
| Marketplace → private room → offer draft | Implemented for published listings; the committed live listing dataset is currently empty | `frontend/data/jobs.json`, `job-conversations.ts` |
| Sample jobs and `/demo` | Simulated UI previews | No real escrow or token transfers |
| Points, VIP and multichain | Planned | No points issuance, subscription billing or additional chain runtime |

The DevNet session update passes **118 tests across 31 files**. These include mocked authentication/rights, encrypted sessions, selected-Party restrictions, transaction approval/rejection and receipt checks. Real user login, fresh cBTC settlement and BitSafe Gold deployment remain unverified; see [Testing](docs/TESTING.md) and [BitSafe Gold](docs/BITSAFE_GOLD.md). OpenMLS scenarios use real encryption with a simulated ledger. The recorded DevNet CC escrow settlement is separate evidence.

## Documentation map

The [document index](docs/README.md) maps materials to all six Season 3 judging criteria. Start with the [pitch deck](docs/vinss-deck.pdf) or use the [submission text](docs/SUBMISSION_FORM.md) for the form.

| Product and business | Technical evidence |
| --- | --- |
| [Value / problem](docs/VALUE_STATEMENT.md) | [Technical overview](docs/TECHNICAL_OVERVIEW.md) |
| [Target audience](docs/ICP_AUDIENCE.md) | [Architecture](docs/ARCHITECTURE.md) |
| [Business brief](docs/BUSINESS_BRIEF.md) | [Messaging verification](docs/MESSAGING_E2E.md) |
| [GTM](docs/GTM.md) and [pilot plan](docs/PILOT_PLAN.md) | [DevNet settlement evidence](docs/CANTON_DEVNET_E2E.md) |
| [Pitch notes](docs/PITCH.md) | [Submission evidence](docs/SUBMISSION.md) |
| | [Deal & Escrow (Rekber)](docs/ESCROW.md) |

Only the pitch deck is a PDF. Value, ICP, Metrics and GTM are Markdown for the submission fields; Demo uses links. Business hypotheses and planned features remain distinct from implemented behavior and recorded test results.

## Setup and operator guides

Use Node 24. From repository root:

```bash
npm ci
npm ci --prefix frontend
cp frontend/.env.example frontend/.env.local
npm run dev --prefix frontend
```

Configure the DevNet server session key or a compatible wallet/network using [Wallet setup](docs/WALLET_SETUP.md), then visit `/connect-test`. HackCanton DevNet login works through a web form; a hosted gateway or WalletConnect provider remains a separate option. No shared account credentials are bundled.

[Deployment](docs/DEPLOYMENT.md) covers Vercel and participant/DAR dependencies. [Testing](docs/TESTING.md) includes automated commands and a browser-only acceptance walkthrough. [BitSafe Gold](docs/BITSAFE_GOLD.md) records the missing DecMan integration and deployment evidence. The current branch is a readiness fix, not proof that all live readiness gates passed.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `frontend/app/`, `frontend/components/` | Product pages and UI |
| `frontend/lib/` | Browser wallet integration, invitations, private/group room runtimes and job entry flow |
| `src/messaging/` | Shared MLS provider, Canton transport, local history and checkpoints |
| `src/canton/` | Ledger client, offer provider, token registry and allocation/settlement helpers |
| [`daml/`](daml/README.md) | Contract index: messaging and **Deal & Escrow (Rekber)** in `daml/Vinss/` |
| `wasm/vinss_mls/` | Rust OpenMLS source; browser bundle is in `frontend/lib/openmls/` |
| `tests/` | Unit/runtime tests and local/live integration scenarios |
| `docs/` | Product narrative, pilot plan, architecture and verification evidence |

The frontend's current messaging path uses the Canton transport. Memory/HTTP relays are alternative core/test implementations. They are not an additional service required by the current browser flow.

## Next

Complete the current wallet-connected Canton workflow with separate users, then validate direct digital-service deals with a small pilot. Marketplace publishing follows that validation.

**Commercial plan — coming soon:** charge only for escrow/rekber at a proposed 0.5% (minimum USD 0.10). Optional individual VIP at USD 3/month would provide 2× qualifying points and a 20% escrow-rate discount: 0.4%, with the same minimum. Core room, chat and deal actions have no proposed separate VINSS application fee. Billing, points issuance and any possible airdrop are not implemented. See [GTM](docs/GTM.md).

**Multichain is a later roadmap direction.** Establish the Canton workflow first, then add chain-specific wallet, privacy and settlement integrations according to user demand. The earlier Starknet repository is a separate implementation; this Canton application does not currently offer cross-chain rooms, bridging or atomic cross-chain settlement.

Dispute/refund handling, cross-device recovery and group escrow are not implemented. See the [pilot plan](docs/PILOT_PLAN.md) before treating the current release as a production payment service.


Grofty direct SDK connection is now an additional wallet option; existing Canton SDK/gateway/WalletConnect paths remain. MainNet-only and mobile/ledger compatibility limits are documented in [Wallet setup](docs/WALLET_SETUP.md). Live Grofty approval and full escrow are unverified.
