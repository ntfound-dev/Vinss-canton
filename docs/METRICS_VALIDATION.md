# VINSS - Metrics / Validation

## A recorded settlement and tested messaging

VINSS has evidence for the payment mechanism and for the local messaging implementation. The records below state exactly what each result establishes.

- **1 CC**: Recorded DevNet settlement
- **69**: Tests passed in 24 files
- **3**: Members in group scenario

## Live payment evidence: 6 October 2026

The recorded Canton DevNet run created a proposal, accepted the agreement, allocated the payment, funded escrow and submitted fulfillment. The reviewer approved, then the fulfiller settled. The resulting receipt references an unlocked receiver holding of 1.0000000000 Amulet, the Canton Coin instrument used in this run.

## Traceable record

Deal ID: freelance-escrow-1791279758. The DevNet evidence document retains the full proposal, allocation, funding, approval and settlement update IDs, the SettlementReceipt ID and receiver Holding ID.

## Automated evidence: 7 October 2026

The reported suite passed 69 tests across 24 files. The integration scenario used production OpenMLS WASM and the Canton messaging transport to exercise 10 messages across its private, group and delayed-reader scenarios. Alice and Bob exchanged messages, and each member of a three-person group sent to both other members.

## What the results establish

The recorded live run demonstrates that the allocation-backed escrow path completed on DevNet. The automated messaging run exercises actual encryption, decryption and state recovery with simulated ledger storage and wallet access. Those tests do not substitute for a fresh live browser-wallet messaging run.

## Evidence tied to the next product decision

The next stage measures whether people can use the complete flow. Technical passes and customer adoption answer different questions.

## What the messaging checks cover

QR tests preserve the full invitation URL and secret. Real MLS tests cover private and group delivery, delayed readers, history reload and replay. Submitted message arguments contain ciphertext. Core removal prevents the removed state from decrypting later messages; the group UI does not yet expose removal.

## Proposed pilot scorecard

Use 3-5 pairs, publish raw counts and explain every failed attempt. The thresholds below are proposed decision rules, not achieved results or statistically reliable market estimates.

| Measure | Definition | Proposed decision rule |
| --- | --- | --- |
| Invite completion | Pairs reaching the private room / pairs attempting the invite. | At least 80% without manual peer-ID help. |
| Workflow completion | Receipted settlements / started controlled deal attempts. | At least 80%; investigate every failure. |
| Repeat use | Pairs starting a second task within 14 days of their first. | At least 2 pairs choose to return. |
| Commercial signal | Repeat users naming a useful VIP benefit and willingness to pay. | At least 2 interviews justify a pricing test. |

## Next live record

Capture the current release hash, isolated wallet identities, message update IDs and visibility checks, plus settlement and receiver holding references. Customer interviews, revenue and retention remain unmeasured in the current evidence.

## Sources

- [Full live settlement identifiers](CANTON_DEVNET_E2E.md#verified-devnet-run-evidence)
- [Messaging verification and limitations](MESSAGING_E2E.md)
- [Integration assertions](../tests/integration/messaging-scenario.mjs)
