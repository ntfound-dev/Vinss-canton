# Testing and user acceptance

## Automated checks

Use Node 24 and install both lockfiles:

```bash
npm ci
npm ci --prefix frontend
npm run typecheck
npm run typecheck --prefix frontend
npm test
npm run build --prefix frontend
npm run test:messaging
```

The root QR test imports root `qrcode`, declared in root devDependencies. It no longer needs frontend/node_modules to exist. Wallet SDK boundary tests live under `frontend/tests` and resolve the frontend SDK by package name. CI installs both packages before the combined Vitest suite, typechecks both and builds Next.js. Do not remove failed suites to obtain green status.

Daml: install the official DPM and SDK 3.5.10; `dpm build` compiles the application. The application currently has no Daml Script unit-test module. The Canton Integration workflow builds the application and test token DARs, runs a real local Canton sandbox, and exercises transaction/messaging integration. Test token sandbox execution does not establish live cBTC settlement.

Rust: follow `.github/workflows/rust-mls.yml`, using its pinned toolchain and wasm-bindgen version. Run `cargo test --manifest-path wasm/vinss_mls/Cargo.toml`, build wasm32, generate bindings and perform the browser smoke check. The included browser WASM can be exercised independently using `npm run test:messaging`.

Live messaging requires existing isolated user credentials and explicit opt-in; see [MESSAGING_E2E.md](MESSAGING_E2E.md). Wallet UI authorization is a separate browser test.

## Current local record (2026-10-09)

The DevNet session update passes both TypeScript checks and **118 tests in 31 files**. Tests cover encrypted session isolation/purpose/tampering/expiry, inactive users, missing CanActAs rights, authorized Party selection, same-origin/DevNet restrictions, read/registry endpoint restrictions, approved command binding, rejection without submission and missing receipt failure. Upstream authentication, ledger rights and transaction receipts are mocked: these tests are not live login or settlement evidence. The bundled real OpenMLS tests still use a simulated ledger.

Next.js production build passes. HTTP smoke checks return 200 for Home, `/connect-test`, `/invite/new`, `/rooms`, `/jobs`, `/deals` and unauthenticated `/api/devnet`. Login with a missing session key returns 503 before forwarding credentials. No owner credentials were available, so browser Party retrieval and a new receipt remain outstanding. Daml/Rust toolchains are absent in this environment; their CI results must be checked after push. A local Chromium download failed and the cloud browser could not reach the local build (`ERR_CONNECTION_REFUSED`); no interactive browser approval was completed here. No fresh CBTC/BitSafe Gold network execution was performed.

### Pruning and chat recovery update (2026-10-10)

The owner supplied production screenshots showing an authorized HackCanton DevNet Party and two room views failing with `PARTICIPANT_PRUNED_DATA_ACCESSED`. One view reported encrypted membership while its ledger reads failed; that badge does not prove successful message delivery.

The update recovers pruned update ranges from current Party-filtered active contracts, preserving original offset order. Six regression tests cover fresh and saved cursors, direct HTTP and wallet-forwarded pruning errors, authorization failures, failed recovery snapshots, and normal retained update reads. The real bundled WASM integration now simulates participant pruning at initial connection and while connected; it verifies group messaging, private messaging in both directions, and private history restoration. Both TypeScript checks, all **124 tests in 32 files**, and the Next.js production build pass locally. Ledger authentication, retention, and transaction receipts in these tests are simulated. They are not live DevNet execution evidence.

After applying and deploying this update, use the existing room without clearing browser storage. Reload both participants' pages, approve remaining handshake requests, wait for both connections, send a different unique message from each Party, and confirm both exact texts on both screens. Refresh once and confirm history. If a request times out after submission, verify its ledger status before sending it again. Record any remaining error and connection stage from each screen; do not claim completion until this browser test succeeds. Active contracts can recover retained welcomes/messages, but cannot reconstruct archived history or replace missing device MLS keys.

Official reference: [Digital Asset Ledger API StateService and pruning constraints](https://docs.digitalasset.com/build/3.4/reference/lapi-proto-docs.html).

### First gate: browser-only DevNet login

1. Deploy the update to **Production** with the server session key configured. Open `https://vinss-canton.vercel.app/connect-test` in a full desktop or Android browser.
2. Confirm `devnet` and sandbox login `available`. Choose **HackCanton DevNet** (not Send Connect), enter your own HackCanton account, and select your own authorized Party if there is more than one.
3. Verify the full Party ID, then press **Check ledger access**. Record the actual offset. This step submits no transaction.
4. Reload: the same verified Party should restore. Disconnect and reconnect. Check one invalid login produces a readable failure without a Party.
5. Create an invite; when a Daml action needs approval, reject once and verify no submission. Retry and approve explicitly. Keep the creator page open for the second user. Record real update/contract IDs.

If login is rejected by Keycloak, do not change the app network. Verify wallet onboarding and the allowed OIDC client with the operator; the form also accepts your own fresh DevNet access token. If the Party has no CanActAs rights, get that user's own Party rights corrected. The sandbox route is node-hosted authorization, not an externally signing wallet.

## Browser-only acceptance (two users)

Use two separate browser profiles/devices with separate authorized DevNet accounts or compatible wallets on the SAME non-production network. Keep one active room tab per installation. Use test cBTC only; do not silently switch to CC.

1. Open `/connect-test`. Connect/approve, choose the correct primary account and confirm full Party ID. Press **Check ledger access**; verify an offset. Reject a connection once, then retry. Reload, disconnect and reconnect.
2. Creator opens Home → Create invite → Private deal. Share the full link or download/scan QR. Keep the original invite page open.
3. Second user opens the invite, checks title/network and connects their different wallet. Approve signed requests/KeyPackage actions. Wait for creator peer resolution and room readiness.
4. Send a unique message in each direction. Confirm exact text once in both rooms; reload and verify local history and room recovery.
5. Freelancer proposes a cBTC offer. Client checks amount, asset, terms and expiry, then **Accept & fund**. Approve each wallet action. Agreement acceptance and funding are separate; verify the card's funded state.
6. Negative recovery: reject the allocation or FundEscrow wallet request after acceptance. Wait for ledger synchronization/reload. Client presses **Retry escrow funding**. If an allocation already committed, confirm no second allocation is created. Work submission must remain unavailable before funded escrow.
7. Freelancer submits work; client requests revision; freelancer submits revision; client approves; freelancer **Settle escrow**. Approve each transaction and verify the final `SettlementReceipt` and receiver holding on the ledger.
8. Open Recent rooms/My deals. Verify room/state after refresh. Open Jobs; distinguish explicitly labeled sample listings from live listings. A real listing requires a correctly configured owner Party and signed application flow.
9. Switch wallet/network. Old Party's history must not appear in the new Party's scope. Wrong-network ledger actions must be blocked with a recovery message. Test the same connection/room flow in a full Android browser.

Record application commit/preview URL, network, two Parties, contract IDs and update references for every successful ledger action. The screenshot of a green build or simulated `/demo` cannot substitute for these results. Stop on unexplained funds/state discrepancies; do not submit a duplicate transaction merely because the UI timed out.

Production completion requires gates: (1) approved wallet + Party + ledger read, (2) two-wallet encrypted chat + actual cBTC receipt/receiver holding, (3) CI + deployed preview + honest Gold evidence. This change does not mark all three gates complete.

## Grofty connection addition

The chooser adds official `@groftylabs/dapp-sdk` 0.2.0 alongside the existing Canton SDK/gateway/WalletConnect routes. Grofty Wallet 2.0.4+ is required and reports `canton:da-mainnet`; DevNet deployments reject it. The direct provider path does not establish Chrome Android pairing or complete escrow compatibility: `/v2/updates` and interface-view support remain limitations. See [wallet setup](./WALLET_SETUP.md) for behavior, recovery and verification status.

Grofty read-only acceptance: open `/connect-test`, choose **Connect Grofty**, approve in an unlocked Wallet 2.0.4+ desktop extension, confirm the primary Party ID, read the ledger offset, reload, switch the wallet primary account, disconnect/reconnect, and reject one approval. A DevNet app must reject `canton:da-mainnet`; do not submit MainNet commands as a workaround. In Chrome Android without an injected provider, confirm the absence/recovery message instead of a fake successful connection. Automated Grofty tests use a fake provider and do not constitute live wallet evidence.
