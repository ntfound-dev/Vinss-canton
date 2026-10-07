# VINSS — demo and evidence

**One product story:** a private conversation becomes an agreement, approved delivery and a Canton payment receipt.

[App](https://vinss-canton.vercel.app) · [Repository](https://github.com/ntfound-dev/Vinss-canton) · [Document index](README.md) · [Pitch deck](vinss-deck.pdf) · [Business brief](BUSINESS_BRIEF.md)

This guide maps the implemented workflow to evidence. It does not claim that every step has been re-verified live in the current release.

## Season 3 materials

| Judging criterion | Material |
| --- | --- |
| Value / Problem | [Value statement](VALUE_STATEMENT.md), [PDF](vinss-value-statement.pdf) |
| ICP / Audience | [Audience](ICP_AUDIENCE.md), [PDF](vinss-icp-audience.pdf) |
| Metrics / Validation | [Validation evidence](METRICS_VALIDATION.md), [PDF](vinss-metrics-validation.pdf) |
| GTM | [GTM](GTM.md), [PDF](vinss-gtm.pdf), [Pilot plan](PILOT_PLAN.md) |
| MVP | [Technical overview](TECHNICAL_OVERVIEW.md), [PDF](vinss-technical-overview.pdf), [Architecture](ARCHITECTURE.md) |
| Pitch | [Deck PDF](vinss-deck.pdf), [Editable deck](vinss-deck.pptx), [Form text](SUBMISSION_FORM.md) |

## What to show

| Product claim | Show or inspect | Evidence boundary |
| --- | --- | --- |
| Guests join without entering technical peer IDs | Alice creates a Private deal invite; Bob opens the complete link/QR and connects his wallet | Signed installation request and KeyPackages are implemented; browser/wallet completion needs a live run |
| Private conversations use real encryption | Alice sends, Bob replies; inspect `EncryptedMessage` content | Real OpenMLS WASM verified locally; ledger/wallet access is simulated in those tests |
| History stays on the user's device | Reload both browsers; inspect local IndexedDB and ledger ciphertext | Current-release messages persist locally; there is no cross-device history service |
| Three people can chat in one encrypted group | Alice creates a Group chat invite and admits Bob and Charlie | Three-member runtime tested locally; groups have no offer/escrow UI |
| Payment follows a recorded deal workflow | Offer → acceptance → allocation/funding → delivery → approval → settlement receipt | Earlier real DevNet settlement includes transaction/receipt IDs; a fresh wallet recording is separate |
| Jobs lead into the same private room | Start from a published listing and inspect the offer draft | Publishing is repository-managed; the current live dataset is empty; sample jobs are previews |

## Recording walkthrough — about three minutes

Prepare Alice and Bob in separate browser profiles with compatible wallets on the same Canton network. Use a test balance and a supported token registry. Check site access and wallet connection before recording. Keep the creator browser available for invitation resolution and group admission. One active room tab per installation avoids unsupported concurrent MLS writes.

| Segment | Screen action | Explain |
| --- | --- | --- |
| 0:00–0:20 | Home | A client and freelancer need a private discussion, an agreed scope and a clear payment state. VINSS connects those steps in one room. |
| 0:20–0:50 | Create invite; Bob opens link or QR | Each person connects their own wallet. VINSS resolves the peer's installation through a signed request rather than manual IDs. |
| 0:50–1:15 | Exchange messages; reload | Members read the messages. The browser keeps local plaintext history; Canton carries encrypted content and visible delivery metadata. |
| 1:15–1:50 | Create and accept offer; inspect funding | Detailed terms remain in the encrypted conversation. Agreement and allocation-backed escrow become Canton records. Show funding success separately from acceptance. |
| 1:50–2:35 | Submit work; approve; settle | The freelancer delivers, the client approves, and the freelancer settles. Display the actual receipt and receiver holding references. |
| 2:35–3:00 | Show group conversation or close on the receipt | Group messaging is implemented separately. Marketplace publishing and optional VIP are next steps; the current payment flow focuses on Canton. |

Leave wallet confirmations and actual waiting time visible. If the network or authorization fails, report that step as incomplete. A `/demo` recording must be described as a simulated preview and cannot substitute for a live transaction or privacy proof.

## Where to read the code

| Responsibility | Source |
| --- | --- |
| Invite descriptor and wallet binding | [canton-invite.ts](../frontend/lib/canton-invite.ts), [InvitePanel.tsx](../frontend/components/workspace/InvitePanel.tsx) |
| Local QR generation | [InviteQr.tsx](../frontend/components/workspace/InviteQr.tsx) |
| Two-person chat, offers and workflow | [canton-room-runtime.ts](../frontend/lib/canton-room-runtime.ts) |
| Group admission and messaging | [canton-group-runtime.ts](../frontend/lib/canton-group-runtime.ts) |
| MLS encryption and synchronization | [provider.ts](../src/messaging/openmls/provider.ts), [Rust OpenMLS source](../wasm/vinss_mls) |
| Local message history | [plaintext-store.ts](../src/messaging/local/plaintext-store.ts) |
| Messaging visibility and delivery | [Messaging.daml](../daml/Vinss/Messaging.daml), [Canton transport](../src/messaging/canton/transport.ts) |
| Agreement and escrow authority | [Deal.daml](../daml/Vinss/Deal.daml) |
| Job → room → offer draft | [job-conversations.ts](../frontend/lib/job-conversations.ts), [JobOfferDraft.tsx](../frontend/components/workspace/JobOfferDraft.tsx) |

## Evidence already recorded

- **2026-10-06, Canton DevNet:** 1.0000000000 Amulet transferred through Token Standard settlement. [The runbook](CANTON_DEVNET_E2E.md#verified-devnet-run-evidence) includes proposal, allocation, funding, approval and settlement updates, the receipt CID and receiver Holding CID.
- **2026-10-07, automated verification:** 69 tests in 24 files passed. The real-WASM integration scenario covers Alice–Bob delivery, three-member groups, delayed readers, reload/replay and ciphertext-only message arguments. [Coverage and limits](MESSAGING_E2E.md).
- **Browser checks:** preview search/filter/pagination, demo workflow, invite selection and responsive routes were checked. These do not establish successful wallet login, a physical camera scan or live settlement for the updated release.

No paying customers, business conversion metrics, production reliability figures or external security audit are recorded in this evidence pack. The [pilot plan](PILOT_PLAN.md) identifies what to validate next.
