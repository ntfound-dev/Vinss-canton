# Messaging verification: Alice, Bob, groups, QR and storage

## Automated verification record (2026-10-07)

The local integration runner uses the **bundled production OpenMLS WASM**, `BrowserOpenMlsBridge`, `OpenMlsMessagingProvider`, authenticated Canton directory, `CantonMessagingTransport`, AES-GCM checkpoint storage and IndexedDB plaintext store. Only ledger storage/Party visibility is simulated; there are no fake encryption or fake decryption functions in this scenario.

```bash
npm test
npm run test:messaging
npm --prefix frontend run typecheck
```

Assertions cover:

- Alice encrypts → Bob decrypts; Bob encrypts → Alice decrypts.
- Unrelated Charlie cannot see the two-person message contracts in the simulated stakeholder visibility model.
- Charlie joins via real MLS Welcome/Commit; each of three members sends to the other two.
- Bob receives a message written before a membership change after being offline; Canton event ordering preserves decryption.
- A fresh Bob bridge loads its encrypted checkpoint and the same local plaintext history, then sends successfully. Replaying cached messages/group-state does not consume the MLS generations again.
- Submitted `EncryptedMessage` arguments contain ciphertext rather than message text or base64 plaintext.
- Core removal excludes Charlie from later recipients and Charlie's old MLS state cannot decrypt the newer ciphertext. Removal is not exposed in the group UI.
- QR decoding returns the exact URL/secret fragment and Unicode title.
- IndexedDB history deduplicates messages, sorts them, separates account/network/room scopes and supports clearing one room.
- A failed wallet polling batch retries the same offset instead of skipping it.
- The actual private-room runtime delivers Alice–Bob messages and restores both sent/received history after reconnect.
- The actual group frontend runtime admits wallet-bound Bob and Charlie without manual peer ID entry, then delivers messages using real WASM over a simulated ledger/wallet client.

These local checks do **not** establish real Canton authorization, gateway availability, DAR deployment or wallet approvals. No live messaging transaction was submitted from this verification environment because it has no authenticated wallet/ledger session. The earlier real escrow run on 2026-10-06 is documented separately in [CANTON_DEVNET_E2E.md](CANTON_DEVNET_E2E.md).

## Opt-in real Canton integration runner

Use three distinct, existing Canton users, one for Alice, Bob and Charlie. Their tokens must be isolated: each user's primary Party must have actAs, exactly one actAs Party, and no readAs right to another Party. Broad operator/admin credentials invalidate the privacy test and are rejected. The runner does not allocate users/Parties or upload DARs.

Prerequisites:

1. Messaging DAR/templates deployed and vetted, as in `daml/Vinss/Messaging.daml`.
2. Ledger JSON API URL accessible from the test environment and authenticated users authorized to create messaging contracts.
3. Root and frontend dependencies installed; bundled browser WASM present.
4. Set the following environment variables **locally**, without sharing or committing credentials:

| Variable | Purpose |
| --- | --- |
| `CANTON_BASE_URL` | Your Canton ledger JSON API base URL |
| `CANTON_ALICE_USER_ID`, `CANTON_ALICE_ACCESS_TOKEN` | Isolated Alice user and bearer token |
| `CANTON_BOB_USER_ID`, `CANTON_BOB_ACCESS_TOKEN` | Isolated Bob user and bearer token |
| `CANTON_CHARLIE_USER_ID`, `CANTON_CHARLIE_ACCESS_TOKEN` | Isolated Charlie user and bearer token |
| `VINSS_RUN_LIVE_MESSAGING=1` | Explicit opt-in to writing real test messaging contracts |

```bash
VINSS_RUN_LIVE_MESSAGING=1 npm run test:messaging:live
```

This executes the same production crypto/transport scenario against your real ledger and checks actual contract visibility. It creates KeyPackageOffer, MlsDelivery and EncryptedMessage contracts using random conversation/installation IDs. It does not transfer tokens or touch existing deals. No automatic test-contract cleanup is implemented. The local history/checkpoint store in this command uses an in-process IndexedDB implementation and lasts only for that process; it is not the application's browser IndexedDB.

Do not use the older `canton-openmls-e2e.mjs` as the default current runner: it expects a separate Rust `pkg-node` build and allocates sandbox Parties with a broad account. It remains as a historical sandbox helper. The new `messaging-live.mjs` uses the included WASM and existing isolated users.

## Verify actual browser/wallet flow

The API runner does not authorize through the browser wallet UI or scan a physical camera. Perform these checks on your deployed site with separate browser profiles/devices:

| Check | Expected result |
| --- | --- |
| Alice creates private invite and downloads QR | QR scans to the exact complete URL; title/network match |
| Bob scans and connects wallet | Signed request and KeyPackage submitted; no manual Party/Installation fields |
| Alice stays on original invite page | Peer resolves and private room opens; retry if initial KeyPackage is pending |
| Alice sends; Bob replies | Both see matching text once, after successful wallet/ledger acknowledgements |
| Reload both rooms | New-release history restores locally; no duplicate bubbles |
| Alice creates Group chat invite and opens group | Creator can admit Bob and Charlie when their signed requests/KeyPackages arrive |
| All three send; late reader returns | Message ordering works across membership epochs; member list becomes three |
| Switch active wallet | Prior wallet plaintext is not loaded into the new wallet room scope |
| Inspect ledger `EncryptedMessage` | CiphertextB64 and metadata; no message content/canonical private offer text |
| Create/accept offer and escrow lifecycle | Actual proposal/agreement/allocation/funding/approval/receipt, with wallet approvals and correct network registry |

## Limits and failure handling

Invitation expiry is a client-side check; invite QR is not signed or revocable. Creator must remain available for group admission. A URL/QR grants access to requesting admission, not wallet identity. Read [ARCHITECTURE.md](ARCHITECTURE.md) for exact binding and confidentiality boundaries.

Do not clear browser storage when testing reload. Plaintext history is intentionally local and unencrypted. Checkpoint and history saves are not one atomic transaction; storage errors/crashes can still make some messages unrecoverable. The release does not recover messages already consumed before plaintext history existed, nor provide cross-device history or cross-tab MLS locking.

A failed live test should retain its error and stop; do not report it as a pass based on local results. Gateway/network errors require checking the external service and its authorization independently of the frontend UI.

## Final local verification record

Recorded results: **69 tests passed in 24 test files**, root/frontend TypeScript checks passed, production Next.js build passed, and the real-WASM messaging scenario completed (10 test messages across the main and delayed-reader rooms). The live runner's opt-in guard rejects an unconfigured invocation.

Browser checks on the production build covered search/category/pagination, sample job → room preview, the explicitly simulated escrow UI lifecycle, invite type switching, incomplete group-link error, theme switching and routes at 320/390/768 pixels. No browser page errors or horizontal overflow were observed. These checks do not simulate a successful wallet login or claim a physical QR camera scan; the QR URL was decoded programmatically.
