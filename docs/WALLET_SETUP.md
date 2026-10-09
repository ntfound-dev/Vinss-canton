# Wallet setup

## Connection methods

VINSS uses the locked `@canton-network/dapp-sdk` 1.7.1, with CIP-103 extension discovery, HTTPS RemoteAdapter gateways, and an optional WalletConnectAdapter. The wallet chooser now also offers **Connect Grofty**, using the official `@groftylabs/dapp-sdk` 0.2.0 directly through its injected provider. The existing Canton SDK picker, RemoteAdapter and optional WalletConnectAdapter remain available under **Other Canton wallet / gateway**. No wallet brand has been verified end to end by this change: Console/Nightly or another Canton wallet must expose the actual methods VINSS uses. A wallet supporting token transfers alone may not support arbitrary Daml commands or `ledgerApi`.

The release no longer advertises a localhost gateway by default. Without an extension, hosted gateway, or configured WalletConnect project, there is no configured connection provider. Enter a gateway only using the RPC URL supplied by your wallet operator. Recent HTTPS gateways remain available for session restoration.

Required wallet methods: `connect`, `disconnect`, `status`, `listAccounts`, `ledgerApi`, `prepareExecuteAndWait`, account/status events. The account must be allocated, enabled, on the wallet's active network, and authorized for the VINSS DAR.

## Public configuration

Copy `frontend/.env.example` to `frontend/.env.local` for development. On Vercel set these in the relevant environment and rebuild:

| Variable | Meaning |
| --- | --- |
| `NEXT_PUBLIC_CANTON_NETWORK` | `devnet` (default), `testnet`, or `mainnet`; sets registries/invite network and WalletConnect chain |
| `NEXT_PUBLIC_CANTON_WALLET_NETWORK_ID` | Exact provider networkId if it uses a custom ID; otherwise VINSS recognizes the deployment network and standard aliases, including `canton:da-mainnet` for `mainnet`. Explicit custom IDs must match exactly. |
| `NEXT_PUBLIC_CANTON_WALLET_GATEWAY_URL` | Optional public HTTPS CIP-103 endpoint; origin alone appends `/api/v0/dapp`, explicit paths remain unchanged |
| `NEXT_PUBLIC_CANTON_WALLET_GATEWAY_NAME` | Optional picker label |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional public WalletConnect project ID; configure allowed application/preview origins |
| `NEXT_PUBLIC_CANTON_CC_ADMIN` | Network-specific DSO Party for explicitly selected CC escrow |
| `NEXT_PUBLIC_CANTON_CC_REGISTRY_URL` | Optional public CC registry override |

Do not put access tokens, passwords, private keys, IdP client secrets or seed phrases in public variables or gateway URLs. A WalletConnect project ID is public configuration, not a ledger credential. The gateway operator must configure authentication, exact allowed origins/CORS, SSE and approval UI independently. An HTTPS page cannot use an HTTP gateway. Do not bypass authentication with a public proxy.

## User steps

1. Open `/connect-test` in a full browser. Allow this site's wallet popup.
2. Choose **Connect Grofty** for its injected provider, or **Other Canton wallet / gateway** for the existing CIP-103 picker, WalletConnect connection or HTTPS gateway.
3. Approve connection and choose the primary allocated Canton account in the wallet. VINSS follows wallet primary selection; it does not alter that selection.
4. Confirm the full Party ID displayed in VINSS. Select **Check ledger access**. This reads the ledger offset without submitting a transaction.
5. Reload and verify restoration, then disconnect/reconnect. Open an invite only after the network matches.

On Android, desktop extensions are not automatically available. Use a supported wallet app with Canton WalletConnect methods or a hosted gateway. Embedded social/chat browsers may block popups; open the link in the full browser. Same-device WalletConnect app switching depends on the wallet; two-device QR approval may be needed. This release does not certify Android deep links.

## Grofty compatibility and limitations

- Install Grofty Wallet **2.0.4 or newer** in a supported desktop browser, unlock/select the active account, reload VINSS, choose **Connect Grofty**, and approve the site. VINSS waits for the official SDK to discover `window.cantonWallet`; it never fabricates a Party ID.
- Grofty reports **`canton:da-mainnet`** and does not support network switching. A DevNet VINSS deployment must reject it. Connection testing on an intentionally configured MainNet deployment can use `/connect-test` and **Check ledger access**, which is read-only. Do not change DevNet to MainNet merely to make an escrow demo pass: MainNet requires matching deployed contracts and registries.
- Grofty's Android app exists, but the official SDK only documents injected provider discovery. Installing that app does not inject a provider into Chrome Android. No documented Chrome Android deep-link, remote gateway or pairing transport was found in the SDK. VINSS displays that limitation when discovery fails; an Android app link is an installation link, not a working pairing button.
- Restore uses only the saved wallet kind and non-interactive wallet authorization checks; the extension remains the authority. Disconnect clears the saved selection. Account changes restrict authority to the primary allocated signing account.
- Generic Daml submission strips `actAs` only after checking it names the active Grofty party; another party in `actAs`/`readAs` is rejected locally. The full disclosed-contract envelope is preserved. A receipt is accepted only when the wallet returns an executed event with an update ID.
- Grofty's read API exposes ledger-end, active-contracts, update-by-id and events-by-contract-id. It does **not** expose `/v2/updates`, which VINSS uses for incremental room synchronization. Interface-view support needed for token allocation is also unverified. This patch adds the direct connection path; it does not establish Grofty support for the complete private-deal/cBTC lifecycle. Unsupported ledger paths produce an actionable error without switching tokens or inventing updates.
- SDK `4001`, `4100`, `-32601`, and `-32603` errors give rejection, unlock/authorization, compatibility, or timeout recovery messages.

Reference: [official Grofty SDK and compatibility notes](https://github.com/groftywallet/grofty-dapp-sdk), [Grofty products](https://www.grofty.cc/).

## Troubleshooting

- Picker never opens: allow popups, finish/cancel an existing picker, retry in a full browser. SDK picker uses a separate blob popup; environments blocking blob popups cannot complete that route.
- Fetch/CORS/401 errors: check the gateway RPC endpoint, origin allowlist and wallet login. VINSS cannot authorize an inaccessible gateway.
- Wrong network: switch the wallet to the displayed application network. Operators with custom IDs must configure the exact expected ID. VINSS blocks mismatches before ledger reads/writes.
- No active Party: allocate/select an account in the wallet; initialized, removed, disabled and other-network accounts are excluded.
- Rejected connection: retry and approve explicitly. No account is fabricated.
- Timeout: VINSS bounds UI waiting, but cannot cancel the wallet's pending authorization. Complete/cancel its window before retrying; it retains one pending connection to prevent competing requests. A late authorized result can still connect. If a wallet has stopped responding, close its request and reload VINSS; no storage wipe is needed.
- A switched/disconnected wallet invalidates the usable session. Reconnect the room using the intended Party. Do not clear IndexedDB to troubleshoot wallet login: that would remove local chat keys/history.

## Verification status

The production app opened its SDK picker on 2026-10-09. The test browser blocked inspection of its `blob:` popup; no approval, Party retrieval or wallet transaction was verified. SDK/network/gateway boundary tests and Grofty adapter tests use mocks/fake providers. Grofty live connection, Chrome Android pairing and the complete Grofty escrow workflow have not been verified. Operator gateway credentials, WalletConnect configuration and an authorized test wallet remain required for live acceptance.

References: [Canton wallet SDK](https://github.com/canton-network/wallet/tree/main/sdk/dapp-sdk), [wallet provider integration](https://github.com/canton-network/wallet/blob/main/docs/dapp-sdk/wallet-providers/integration-overview.md), [CIP-103](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md).
