# VINSS documentation

VINSS connects a private conversation to an agreement, delivery review and payment settlement on Canton. This folder packages the product, business and technical evidence for HackCanton League Season 3.

## Start here

Read the [pitch deck](vinss-deck.pdf) for the product story, then [Demo and evidence](SUBMISSION.md) for the walkthrough and code map. [Submission text](SUBMISSION_FORM.md) contains the six judging sections ready to copy into the form.

For payment, read [Deal & Escrow (Rekber)](ESCROW.md): roles, funding checks, delivery, revisions, approval and settlement. The [smart contract index](../daml/README.md) points directly to the messaging and escrow modules.

## Materials by judging criterion

| Criterion | Readable PDF | Editable source / detail |
| --- | --- | --- |
| Value / Problem Statement | [Product value](vinss-value-statement.pdf) | [Value statement](VALUE_STATEMENT.md), [Business brief](BUSINESS_BRIEF.md) |
| ICP / Audience | [Target users](vinss-icp-audience.pdf) | [Audience](ICP_AUDIENCE.md) |
| Metrics / Validation | [Evidence summary](vinss-metrics-validation.pdf) | [Validation](METRICS_VALIDATION.md), [Messaging checks](MESSAGING_E2E.md), [DevNet settlement](CANTON_DEVNET_E2E.md) |
| GTM Materials | [Go-to-market](vinss-gtm.pdf) | [Distribution and business model](GTM.md), [Pilot plan](PILOT_PLAN.md) |
| MVP Materials | [Technical summary](vinss-technical-overview.pdf) | [Technical overview](TECHNICAL_OVERVIEW.md), [Architecture](ARCHITECTURE.md), [Demo guide](SUBMISSION.md) |
| Pitch Materials | [Ten-slide pitch](vinss-deck.pdf) | [Editable deck](vinss-deck.pptx), [Pitch outline](PITCH.md), [Form text](SUBMISSION_FORM.md) |

## How the records relate

Markdown is the source text for the PDF briefs. The PPTX is the editable presentation. Architecture describes the current implementation and its trust boundaries. The DevNet runbook retains the dated settlement transaction and contract IDs.

The 69-test automated result uses real OpenMLS WASM over simulated ledger/wallet access. The earlier 1 CC DevNet settlement is separate live evidence. Proposed audiences, acquisition channels and pilot measures are business hypotheses. Points, VIP billing and multichain remain planned.
