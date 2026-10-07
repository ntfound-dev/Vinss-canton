# Metrics and validation — VINSS

Evidence cutoff: 7 October 2026. Technical results below come from the recorded repository run and developer-supplied test output. They are not new tests performed while writing this document.

## 1. North Star metric

**Genuine buyer–seller deals settled through VINSS per week.**

This measures whether two people finish the transaction they came to do. Messages, room creation and wallet connections alone do not show that value was delivered.

Count unique deal IDs with a settlement receipt, tied to a consented pilot record confirming an actual exchange between distinct participants. Exclude team smoke tests, simulated-ledger tests, duplicate receipts, self-dealing and reward farming. A ledger receipt proves an action happened; it does not by itself prove independent customer demand. The pilot register should contain minimal operational data, not private message contents.

## 2. What we need to validate

| Assumption | Why it matters | Status |
| --- | --- | --- |
| The initial segment loses time or accepts unwanted risk in direct deals. | Establishes a specific reason to change behavior. | Testing planned; no interview evidence supplied. |
| Both people will move an existing deal into a VINSS room. | Value requires participation by both sides. | Testing planned; no measured conversion. |
| A completed deal leads to repeat use without reward incentives. | Separates product utility from points activity. | Not yet measured. |
| Users will pay the proposed escrow fee or individual VIP subscription. | Determines commercial viability. | Pricing hypothesis; billing not implemented. |
| The core workflow can execute a Canton settlement. | Establishes technical feasibility. | Confirmed for the recorded 1 CC DevNet scenario; not a general reliability claim. |

## 3. Conversations

No documented customer interviews were supplied for this submission draft. There is no attributable customer quote to publish.

| Planned conversation | What we need to learn | Current record |
| --- | --- | --- |
| Buyer with a recent direct digital-work purchase | How scope, funding and acceptance were checked; why they would switch. | Person/date/notes not yet collected. |
| Seller with a recent direct digital-work sale | What payment assurance they required and where the deal stalled. | Person/date/notes not yet collected. |
| Repeat buyer or seller | Whether repeated coordination justifies paying; reaction to actual proposed prices. | Person/date/notes not yet collected. |

The organizer's three-conversation checklist remains unmet by the evidence available here. Record real findings, including rejections, before changing that status.

## 4. Tests and results

| Test | Recorded result | What it establishes |
| --- | --- | --- |
| Canton escrow run, 6 October | 1 CC transferred; settlement receipt and receiver holding recorded. | One real DevNet escrow/settlement scenario completed. |
| Automated suite, developer log on 7 October | 69 tests passed across 24 files. | Coverage of implemented behaviors in those tests. |
| Messaging integration | 10 test messages across direct and three-member scenarios. | Real OpenMLS WASM with simulated wallet and ledger; not live Canton traffic. |
| Messaging recovery and privacy cases | Local plaintext reload, checkpoint recovery, replay, membership removal and delayed-Welcome cases passed in the supplied local run. | Defined local scenarios work; not a production security audit. |

Alice → Bob, Bob → Alice and each member of a three-person group were exercised locally. Submitted test contracts carried ciphertext rather than message plaintext. QR round-trip and group admission are covered by automated tests. A fresh recording of the current browser-wallet flow on live DevNet is still needed.

**What changed during development:** link/QR onboarding, local readable history and group messaging were added; cursor migration, retry and membership-ordering cases received tests. This is engineering iteration, not a claim that customer interviews drove these changes. Usability feedback on the materials also led us to separate the pitch narrative from implementation reference documents.

## 5. Product and on-ledger metrics

Targets below are proposed submission checks, not completed results or promises about remaining time.

| Metric | Measurement | Now | Target by submission |
| --- | --- | --- | --- |
| External users who tried the demo | Distinct consented participants; separate the team. | Not measured. | 2 external participants, if recruitable. |
| External pairs completing the core flow | Invite through receipt; one completed deal per pair. | Not measured. | 1 observed pair on DevNet. |
| DevNet settlement evidence | Unique receipt and update IDs. | 1 historical 1 CC settlement documented. Total network transaction count not aggregated. | 1 fresh end-to-end run of the current browser flow with IDs retained. |
| MainNet transactions | Network-qualified receipt IDs. | No MainNet evidence supplied. | No MainNet claim required for this MVP. |
| Active external Parties | Distinct Parties performing a deal action in the observation period. | Not measured; simulated members excluded. | 2 distinct external Parties in the observed pair. |

If these targets are not reached, retain the actual values and explain the blocker. Do not relabel automated test accounts as users.

## 6. Success criteria after the hackathon

| Metric | Proposed 90-day target |
| --- | --- |
| Problem interviews | 10 documented conversations about recent direct deals. |
| Pilot participation | 10 individuals in five buyer–seller pairs. |
| Core completion | At least four of five pilot pairs complete a DevNet rehearsal. |
| Repeat demand | At least two pairs voluntarily request a second deal without points incentives. |
| Commercial evidence | Five explicit pricing discussions; record acceptance, rejection and reasons. |
| Operational learning | Measure support minutes and infrastructure cost for every pilot deal. |

These are learning targets. A broader live-value rollout depends on reliability and unresolved settlement/recovery design; the pilot is not a MainNet launch commitment.

## 7. What we still do not know

We need to learn whether bringing the second person into Canton is worth the effort, which deal types fit the current approval model, whether lack of a dispute/refund path blocks use, how often users return, and whether the proposed fees cover actual costs. Interviews, observed task completion and measured pilot costs—not more synthetic transactions—will answer those questions.

### Evidence

- [DevNet record](https://github.com/ntfound-dev/Vinss-canton/blob/2709b047ea6a53e74d3b894802d5c599d10759ff/docs/CANTON_DEVNET_E2E.md): deal `freelance-escrow-1791279758`; settlement update `1220855bf3dc659be03723e344b9dd636b63e019fc436a3d637e0ac3f339f24ad779`.
- [Messaging evidence and test boundaries](https://github.com/ntfound-dev/Vinss-canton/blob/2709b047ea6a53e74d3b894802d5c599d10759ff/docs/MESSAGING_E2E.md), [integration scenario](https://github.com/ntfound-dev/Vinss-canton/blob/2709b047ea6a53e74d3b894802d5c599d10759ff/tests/integration/messaging-scenario.mjs), [group runtime test](https://github.com/ntfound-dev/Vinss-canton/blob/2709b047ea6a53e74d3b894802d5c599d10759ff/tests/canton-group-runtime.test.ts).
