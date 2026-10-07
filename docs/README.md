# VINSS documentation

VINSS is a private deal room connecting conversation, agreed terms and escrow settlement on Canton. Start with the submission material for the product story; use the technical references to inspect implementation and evidence.

## HackCanton submission

| Form section | Material | Format |
| --- | --- | --- |
| Value / problem | [Value statement](VALUE_STATEMENT.md) | Markdown, ready to paste. |
| ICP / audience | [Ideal customer profile](ICP_AUDIENCE.md) | Markdown, ready to paste. |
| Metrics / validation | [Metrics and evidence](METRICS_VALIDATION.md) | Markdown, ready to paste. |
| GTM | [Go-to-market](GTM.md) | Markdown, ready to paste. |
| Demo | [Submission fields](SUBMISSION_FORM.md#demo) | Live URL, video URL when available, repository URL. |
| Pitch | [VINSS pitch deck](vinss-deck.pdf) | The only submission PDF; under 10 MB. |

[Submission form guide](SUBMISSION_FORM.md) maps the material to the fields. [Pitch notes](PITCH.md) contain the deck narrative and a short recording sequence. [Submission overview](SUBMISSION.md) summarizes what is available and what remains unverified.

## Product and business

- [Business brief](BUSINESS_BRIEF.md) — product scope, initial customer hypothesis and proposed revenue model.
- [Pilot plan](PILOT_PLAN.md) — recruitment, measurement and decision gates.

## Implementation and evidence

- [Technical overview](TECHNICAL_OVERVIEW.md) — privacy, invitation, escrow and implementation boundaries.
- [Architecture](ARCHITECTURE.md) — components and data flows.
- [Escrow / rekber](ESCROW.md) — contract states and authorized actions.
- [Messaging verification](MESSAGING_E2E.md) — local integration and live-test requirements.
- [Canton DevNet evidence](CANTON_DEVNET_E2E.md) — historical 1 CC settlement and transaction references.
- [Daml modules](../daml/README.md) — contract source map.

The original [Starknet VINSS documents](https://github.com/DXJLabs/vinss/tree/main/docs) explain the product foundation. Canton behavior is governed by this repository's code. Fee/VIP/points plans are not implemented features. Current evidence and future targets are separated in the metrics document.
