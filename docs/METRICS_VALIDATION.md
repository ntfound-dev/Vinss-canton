# VINSS - Metrics / Validation

**Technical evidence, with its scope visible.**

VINSS has a recorded Canton DevNet settlement and current automated checks using real OpenMLS WASM. They answer different questions and should be evaluated separately.

## Recorded live settlement: 6 October 2026

**What happened.** The escrow run transferred 1.0000000000 Amulet on DevNet and produced a SettlementReceipt. The record includes agreement, allocation, funding, approval and settlement update IDs, plus the receiver Holding CID.

**Where to verify.** CANTON_DEVNET_E2E.md, section "Verified DevNet run evidence". This is earlier live settlement evidence, not a fresh wallet test of the updated release.

## Automated verification: 7 October 2026

**Results.** 69 tests passed across 24 test files. The integration scenario completed 10 test messages using bundled OpenMLS WASM and production Canton messaging transport over a simulated ledger.

**Coverage.** Alice-Bob replies, three-member groups, delayed readers across membership changes, checkpoint/history reload, replay deduplication, QR URL round-trip and ciphertext-only message arguments.

**Boundary.** Ledger storage, visibility and wallet access are simulated in these checks. They do not prove current live authorization, wallet approvals or unrelated-Party visibility on the actual network.

## Next validation

**Live software.** Repeat invitation, chat, group and escrow with isolated wallets. Record actual update IDs, receiver holdings and visibility results.

**User outcomes.** Track successful invite joins, completed workflows versus attempts, wallet failures, time to agreement and settlement, repeat use and interview feedback.

## Current boundaries

No user interview results, revenue, conversion rate, retention or external security audit are recorded. Proposed success metrics are not achieved business results.

## Sources

- [CANTON_DEVNET_E2E.md#verified-devnet-run-evidence](CANTON_DEVNET_E2E.md#verified-devnet-run-evidence)
- [MESSAGING_E2E.md](MESSAGING_E2E.md)
- [tests/integration/messaging-scenario.mjs](../tests/integration/messaging-scenario.mjs)
