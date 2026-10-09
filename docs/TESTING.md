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

The DevNet routing update passes both TypeScript checks, **97 tests in 29 files**, and the Next.js production build. HTTP smoke checks return 200 for Home, `/connect-test`, `/invite/new`, `/rooms`, `/jobs`, and `/deals`; rendered diagnostics show the network/gateway setup state. Added tests cover network filtering, missing gateway errors before wallet approval, dedicated gateway selection despite installed extensions, preservation of TestNet/MainNet paths, and retry after SDK initialization failure. These use mocks and do not prove live wallet authorization. Interactive desktop/Android verification of this patch was not completed; a local Chromium download failed in this environment.

DevNet browser acceptance: open the updated production `/connect-test`; the chooser must not offer Send Connect for DevNet. With no configured gateway and only Send installed, **Other DevNet wallets** must show a readable error without opening Send approval. **DevNet wallet** remains unavailable until the operator supplies a real gateway. With that endpoint configured, approve there, verify the correct Party ID, read the ledger offset, reload, then disconnect/reconnect. That second phase is externally blocked and has not been completed. See [Wallet setup](WALLET_SETUP.md#hackcanton-devnet-access).

- Root and frontend TypeScript: passed.
- Vitest: 76 tests passed across 26 files, including wallet boundary/network tests and allocation recovery tests.
- Next.js production build: passed; routes include `/connect-test`, invites, rooms, jobs and deals.
- Real bundled OpenMLS WASM with simulated ledger: passed two-person, three-member, reload, ordering, ciphertext and member-removal scenarios (10 messages). No live network claim.
- Daml compiler and Rust toolchain: absent in this execution environment; not locally run. Consult PR workflow runs for their results.
- Browser production connection: picker opened; this test browser blocked access to the SDK's blob popup. No Party retrieval or approval verified.
- Fresh cBTC settlement and DecMan deployment: not run; infrastructure/wallet authorization absent.

## Browser-only acceptance (two users)

Use two separate browser profiles/devices with allocated, compatible wallets on the SAME non-production network. Keep one active room tab per installation. Use test cBTC only; do not silently switch to CC.

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
