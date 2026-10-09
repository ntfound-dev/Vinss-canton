# BitSafe Gold: design and outstanding verification

**Status on 2026-10-09: not implemented or verified. Do not claim Gold compliance.**

Gold refers to the Decentralized Party deployment challenge, not a gold token integration. The owner reports an extended deadline. This audit could not retrieve the current challenge text or confirm the extended date/deployment conditions from a current official source. The official workshop search result still mentioned an October 4 application cutoff; that is historical and must not override the reported extension. Obtain the current organizer challenge terms before choosing a required DevNet/MainNet deployment.

## Existing Daml audit

`daml.yaml` imports Token Standard interfaces. `Vinss.Deal` has ordinary seller/buyer/reviewer/fulfiller Parties. `Vinss.Messaging` carries Party-authorized bindings and encrypted envelopes. There is no DecMan dependency/module, multi-operator topology provisioning, governed application workflow, decentralized Party ID, node quorum or deployment evidence in this repository. Using the cBTC admin Party does not decentralize VINSS's own application workflow.

## Proposed integration boundary (not implementation)

Keep ordinary chat/deal actions controlled by their users. A meaningful DecMan application module could govern registration and upgrades of approved VINSS application packages through a shared operator Party. That requires a concrete Daml governance module integrated with DecMan's supported workflow, rather than adding a Party string to the frontend. Package approvals must actually affect the participant vetting/deployment process used by the app. This is a design proposal awaiting operator access and challenge confirmation; current deals do not exercise it.

## Deployment procedure and prerequisites

1. Obtain the current organizer requirements, accepted application and participating independent operators. Confirm networks and approval threshold.
2. Each operator needs a participant node, appropriate Canton authorization, DecMan runtime, authenticated operator UI, persistent state and peer connectivity. Vercel hosts the frontend; it cannot substitute for these participants.
3. Pin a reviewed DecMan release and follow its official deployment guide. Exchange operator peer identities, configure party credentials privately, and create the Decentralized Party through the supported operator workflow.
4. Implement/review the VINSS governance module against that pinned release, compile its DAR, distribute identical package hashes, obtain quorum approvals and deploy/vet on the intended participants.
5. Run the governed package-registration/upgrade workflow with independent approvals. Demonstrate that its outcome is used by VINSS; then run a real private deal using those packages.
6. Collect topology, workflow confirmations, package registration, contract and ledger update references. Verify threshold behavior and reject an unauthorized single-operator action.

MainNet deployment and real funds require the owner's explicit authorization. None were executed in this audit.

## Evidence checklist

| Required evidence | Current record |
| --- | --- |
| Current challenge/extension terms | Not independently retrieved |
| Decentralized Party ID and network | Missing |
| Independent participant identities, threshold and topology | Missing |
| DecMan pinned release and application module/DAR hash | Missing |
| Meaningful governed action and independent approval references | Missing |
| DevNet/MainNet package/transaction evidence as required by challenge | Missing |
| Operator authorization and test wallets | Not provided in this session |

Do not publish operator access tokens or private party credentials with evidence. Fill this table only from actual verified execution. The historical CC escrow receipt in `CANTON_DEVNET_E2E.md` is not Gold or cBTC evidence.

Official references: [DecMan overview](https://docs.bitsafe.finance/decentralization-manager), [source](https://github.com/DLC-link/decentralization-manager), [deployment guide](https://github.com/DLC-link/decentralization-manager/blob/main/docs/DEPLOYMENT_GUIDE.md), [technical workshop](https://www.youtube.com/watch?v=T82CVdGk7QI), [challenge portal](https://appsfactory.cc/hackathons).
