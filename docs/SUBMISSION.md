# VINSS — HackCanton submission

**VINSS connects private conversation, agreed terms and escrow settlement in one deal room.**

The initial use case is a small digital task between two crypto wallet users who have arranged a deal directly. VINSS lets them retain private negotiation while following an accepted offer, funding, delivery review and settlement. The broader product is a private transaction workspace, with Marketplace Jobs as an additional discovery entry point.

## Materials

- [Value / problem](VALUE_STATEMENT.md)
- [ICP / audience](ICP_AUDIENCE.md)
- [Metrics / validation](METRICS_VALIDATION.md)
- [Go-to-market](GTM.md)
- [Pitch deck — PDF](vinss-deck.pdf)
- [Form fields and demo links](SUBMISSION_FORM.md)

Live application: https://vinss-canton.vercel.app  
Repository: https://github.com/ntfound-dev/Vinss-canton  
Video: not supplied yet.

## What exists

Wallet-connected Canton UI; private link/QR invites; encrypted direct and group messaging with local plaintext history; two-party offers and escrow/review/settlement; marketplace browsing and a valid-job-to-room entry flow. The committed live job catalogue is empty and self-service publishing is not implemented.

## What is evidenced

A historical 1 CC Canton DevNet settlement is recorded with ledger references. The supplied local run reports 69 passing tests across 24 files and a ten-message OpenMLS integration covering Alice/Bob and a three-member group. That integration uses a simulated wallet and ledger. A fresh live recording of the current browser workflow and independent customer validation remain outstanding.

## What comes later

Only escrow/rekber would carry a VINSS transaction fee: proposed 0.5%, minimum USD 0.10. Optional individual VIP at USD 3/month would provide 2× qualifying points and a 20% escrow-rate discount (0.4%, same minimum). Core room, chat and deal actions would not carry separate VINSS application fees. These plans, points issuance and any possible VINSS airdrop are not implemented. Multichain is outside the current Canton focus.

The current escrow module has no dispute/refund choice; group messaging does not imply group escrow. [Technical overview](TECHNICAL_OVERVIEW.md) and [Escrow](ESCROW.md) explain the boundary.

## Readiness update — 2026-10-09

The DevNet browser route now connects the existing NODERS HTTP runbook to own-account login, verified CanActAs Party selection, ledger reads and explicit in-app transaction approval. This is node-hosted sandbox authorization, not external wallet signing. Local checks pass 118 tests in 31 files; authentication and transaction upstreams are mocked. Owner login and new live receipts have not been verified. Grofty and existing Canton adapters remain available; MainNet operations were not executed.

Wallet configuration/network validation, read-only diagnostics, funding retry with allocation reuse, root QR dependency ownership and frontend CI build were improved in a dedicated readiness branch. Local tests: 76 across 26 files; real bundled OpenMLS was exercised with a simulated ledger. This is not a fresh network or wallet-authorized cBTC run.

Live readiness is still gated on an authorized compatible wallet, configured deployment/provider and two-user cBTC settlement evidence. The SDK picker opened in the production browser check, but its blob popup could not be inspected in that test environment. Party retrieval was not verified. Existing DevNet evidence is 1 CC from October 6, not cBTC. BitSafe Gold has no implemented DecMan workflow, decentralized VINSS Party or deployment evidence; the reported deadline extension was not independently confirmed. See [Testing](TESTING.md), [Wallet setup](WALLET_SETUP.md), [Deployment](DEPLOYMENT.md), and [BitSafe Gold](BITSAFE_GOLD.md).
