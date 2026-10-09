# Wallet setup

## Connection methods

VINSS uses the locked `@canton-network/dapp-sdk` 1.7.1, with CIP-103 extension discovery, HTTPS RemoteAdapter gateways, and an optional WalletConnectAdapter. The chooser also offers **Grofty**, using the official `@groftylabs/dapp-sdk` 0.2.0 directly through its injected provider, enabled only on MainNet. The existing Canton SDK picker, RemoteAdapter and optional WalletConnectAdapter remain under **Other Canton wallets** (or **Other DevNet wallets**). No wallet brand has been verified end to end by this change. A wallet supporting token transfers alone may not support arbitrary Daml commands or `ledgerApi`.

The SDK now uses a VINSS picker callback. On DevNet it excludes the published Send Connect and Grofty releases before wallet approval and turns off the SDK's incompatible suggested-wallet list. On TestNet it keeps Send and excludes Grofty; on MainNet it keeps both. Unknown wallets remain discoverable and must pass actual network/account validation. The dedicated gateway choice offers only the configured remote gateway, so discovering Send in Chrome cannot redirect that choice to Send. Gateway selection opens the configured approval flow even if the SDK previously restored an extension session. Initialization failures recreate the SDK instance for a fresh retry.

The release no longer advertises a localhost gateway by default. HackCanton DevNet has an additional browser sign-in route described below. Other networks require a compatible extension, hosted gateway, or configured WalletConnect provider. Enter a gateway only using the RPC URL supplied by your wallet operator. Recent HTTPS gateways remain available for session restoration.

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
2. On DevNet choose **HackCanton DevNet**, sign in with your own HackCanton account, and select your authorized Party. For an external wallet, choose **Wallet gateway**, **Grofty** on MainNet, or **Other Canton wallets** / **Other DevNet wallets** for compatible CIP-103 discovery.
3. Sandbox login verifies the real ledger user and CanActAs rights; multiple authorized Parties require explicit selection. External-wallet connections require approval and primary account selection in that wallet.
4. Confirm the full Party ID displayed in VINSS. Select **Check ledger access**. This reads the ledger offset without submitting a transaction.
5. Reload and verify restoration, then disconnect/reconnect. Open an invite only after the network matches.

On Android, **HackCanton DevNet** uses the same web sign-in form without an extension. Actual account login still needs acceptance testing. Desktop extensions are not automatically available in Chrome Android; other wallet routes require a supported wallet app with Canton WalletConnect methods or a hosted gateway. Embedded social/chat browsers may block popups; open the link in the full browser. Same-device WalletConnect app switching depends on the wallet; two-device QR approval may be needed. This release does not certify Android deep links.

## HackCanton DevNet access

The shared node endpoints supplied by HackCanton serve different roles:

| Service | Purpose |
| --- | --- |
| `https://wallet.validator.hackcanton-01.devnet.naas.noders.services` | Sandbox web wallet and wallet login |
| `https://console.participant.hackcanton-01.devnet.naas.noders.services` | Participant console and operator/user tools |
| `https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services` | Authenticated JSON Ledger API, not CIP-103 |
| Operator-supplied CIP-103 Wallet Gateway | dApp connection, user approval, authorized ledger queries and commands |

On 2026-10-09 a credential-free `status` POST to the NODERS web wallet's `/api/v0/dapp` returned **HTTP 405, HTML**, not a CIP-103 RPC response. Its public `config.js` configures a Splice validator wallet UI with Keycloak login. This verifies that this web-wallet URL cannot simply be assigned as VINSS's CIP-103 gateway. It does not establish that NODERS has no other gateway; none was supplied or verified here. No login or transaction was executed in this check.

### Browser login using the existing HTTP runbook

Choose **HackCanton DevNet** to use the same node-hosted HTTP Ledger API recorded in [CANTON_DEVNET_E2E.md](CANTON_DEVNET_E2E.md). It does not need a CIP-103 gateway or Send extension. Each user supplies their own HackCanton email/password to the explicit sign-in form; those credentials are sent over HTTPS through VINSS to the fixed NODERS Keycloak token endpoint. No shared account or bearer token is bundled. Never submit your credentials in chat or a screenshot.

Required server-only variable: **`VINSS_DEVNET_SESSION_SECRET`**, 64 random hex characters (32 bytes). Configure it separately for Production/Preview, without `NEXT_PUBLIC_`, then rebuild/deploy. See [Deployment](DEPLOYMENT.md). Missing configuration is displayed in `/connect-test` and sign-in fails before any credential request.

The default public client ID is `web-app-ui-hackcanton-01-devnet`; server-only `CANTON_DEVNET_OIDC_CLIENT_ID` can replace it only with an operator-confirmed client. Direct password grant must be enabled for that client. A credential-free probe with empty username/password returned `401 invalid_grant`, so client validation reached the credential stage; **no real login was verified**. Accounts needing browser-only identity federation or incomplete MFA setup may reject this grant. Use your own fresh access token in the dedicated sign-in form or ask the operator for the permitted method; do not use another user's token. PKCE sign-in is not yet implemented and needs registered application redirect URLs.

After authentication, VINSS checks the actual `/v2/authenticated-user` and `/v2/users/:id/rights`. Deactivated users and users without CanActAs rights are rejected. Only those authorized Parties appear for selection. Tokens are encrypted in an HttpOnly, SameSite=Strict cookie (Secure on HTTPS) for at most one hour or token expiry. Passwords/refresh tokens are not retained, and tokens never enter localStorage. Refresh restores the session through a new identity/rights check; logout clears it. A revoked token or expired session requires sign-in again.

Every Daml submission opens **Approve DevNet transaction** in VINSS. Review the named commands and full envelope before approving. Rejection sends no submission. This is a **NODERS hosted sandbox Party**, with ledger authorization exercised by the VINSS server and participant; it is not an independently signing self-custody wallet. Keep sensitive/production assets off the shared hackathon node. Existing Grofty/CIP-103 wallet routes retain their own authorization and signing behavior.

Explicit CC escrow discovers the current DSO through the authenticated validator scan proxy and uses that registry. CBTC remains a separate asset/registry. A missing DSO, insufficient holdings, unavailable utility registry, unvetted DAR, or missing party rights blocks the relevant action; it must not be shown as successful.

For external-wallet authorization, ask the operator for a DevNet CIP-103 endpoint and configure its exact public RPC URL as `NEXT_PUBLIC_CANTON_WALLET_GATEWAY_URL`. The gateway operator must confirm identity/signing, allowed origins and VINSS package vetting. This is an optional separate connection path, not a prerequisite for the new sandbox HTTP route.

Send Connect 0.6.0 [lists MainNet and TestNet](https://chromewebstore.google.com/detail/send-connect/ldmohiccoioolenadmogclhoklmanpgi), not DevNet. Its TestNet passkey login is a different network. Do not change VINSS to TestNet/MainNet just to clear login: its Daml packages, registries, administrators and ledger deployment must also exist on that network.

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

The new DevNet session and transaction tests use mocked upstream authentication/ledger responses. Actual owner login, Party retrieval in a real browser, and a new two-user receipt have not been verified. The historical 1 CC settlement remains the only recorded live settlement; it does not prove fresh CBTC execution or BitSafe Gold compliance. Grofty live connection and Android pairing remain unverified.

References: [Canton wallet SDK](https://github.com/canton-network/wallet/tree/main/sdk/dapp-sdk), [wallet provider integration](https://github.com/canton-network/wallet/blob/main/docs/dapp-sdk/wallet-providers/integration-overview.md), [CIP-103](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md), [authenticated ledger user](https://docs.canton.network/reference/json-api-reference/get-v2authenticated-user), [Keycloak OIDC grants](https://www.keycloak.org/securing-apps/oidc-layers).
