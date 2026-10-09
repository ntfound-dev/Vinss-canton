# Deployment

## Frontend

Vercel configuration is at repository root `vercel.json`: install root and frontend lockfiles, build `frontend`, output `frontend/.next`. Use Node 24. Set public variables from [WALLET_SETUP.md](WALLET_SETUP.md) in Preview and/or Production and rebuild; Next.js embeds `NEXT_PUBLIC_*` at build time. Updating variables alone does not change an already-built client.

```bash
npm ci
npm ci --prefix frontend
npm run typecheck
npm run typecheck --prefix frontend
npm test
npm run build --prefix frontend
```

Open a dedicated branch PR and use the connected Vercel Git integration's preview. Check its deployment status and preview URL on that PR. If no preview is created, a project owner must connect/authorize Vercel for the repository and configure the environment. Do not report the existing production URL as a deployment of unmerged changes.

Optional operator CLI from repository root after authorized Vercel login:

```bash
npx vercel
```

That command creates a **Preview**, with a generated URL. It does not update `https://vinss-canton.vercel.app`. To deploy the local branch to the existing production project:

```bash
cd ~/vinss-canton
npx vercel --prod
```

Confirm the CLI prints **Production**, **Aliased https://vinss-canton.vercel.app** and **Ready**. Vercel Production/Preview and Canton MainNet/DevNet are separate configuration choices. A Production website can use Canton DevNet. Preview and Production variables can differ; configure and rebuild the environment being tested. Vercel Authentication may restrict unauthenticated testers; the project owner controls that setting.

The DevNet gateway requirement is in [Wallet setup](WALLET_SETUP.md#hackcanton-devnet-access). Neither a successful deploy nor a visible Send Connect extension supplies a DevNet signing provider. The sandbox web wallet is not a verified CIP-103 endpoint. Obtain the gateway URL from the operator, configure `NEXT_PUBLIC_CANTON_WALLET_GATEWAY_URL`, and verify actual approval, Party ID and ledger read after deployment.

Use a preview first. Promote only a reviewed build whose wallet and ledger configuration matches the intended network. Real-funds MainNet transactions/DAR deployment are outside this change's authorization.

## Canton dependencies

The frontend does not deploy Canton contracts. Upload/vet the compiled VINSS DAR on every required participant and connect the intended synchronizer. `daml.yaml` pins SDK 3.5.10 and Token Standard dependencies in `deps/`. `.github/workflows/canton-deploy.yml` provides a manually invoked DevNet/TestNet upload and package-status verification. Configure `CANTON_LEDGER_URL`, `CANTON_AUTH_TOKEN` and optional `CANTON_SYNCHRONIZER_ID` as environment secrets. Never put them in frontend public variables.

Wallets must authorize usable Parties and expose ledger queries plus Daml execution. The token registrar/registry, admin Party, holdings and allocation services must match that same network. A correctly deployed Next.js page cannot supply missing participant access, test cBTC or gateway authorization. BitSafe’s official faucet additionally requires the recipient node to have the DA Utility Registry installed; accept its test-token transfer before attempting allocation.

DecMan deployment needs independent operator infrastructure; see [BITSAFE_GOLD.md](BITSAFE_GOLD.md). It is not deployed through Vercel.

## Smoke and rollback

Open Home, `/connect-test`, `/invite/new`, `/rooms`, `/jobs`, `/deals` on desktop and Android. Check browser errors, wallet approval and authenticated ledger read. Complete [TESTING.md](TESTING.md)'s two-user workflow before declaring readiness. Label sample jobs and `/demo` as simulated.

Rollback frontend to the last reviewed Vercel deployment if needed. Preserve local browser IndexedDB and existing ledger contracts. Rolling back JavaScript does not undo an accepted agreement, allocation or settled transfer. Query the live ledger before recovery and use funding retry only for the surviving agreement. There is no VINSS refund/dispute UI.

## Grofty connection addition

The chooser adds official `@groftylabs/dapp-sdk` 0.2.0 alongside the existing Canton SDK/gateway/WalletConnect routes. Grofty Wallet 2.0.4+ is required and reports `canton:da-mainnet`; DevNet deployments reject it. The direct provider path does not establish Chrome Android pairing or complete escrow compatibility: `/v2/updates` and interface-view support remain limitations. See [wallet setup](./WALLET_SETUP.md) for behavior, recovery and verification status.
