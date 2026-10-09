# VINSS Canton architecture

This document maps the implemented Canton wallet, OpenMLS messaging, invitation, storage and escrow code to its trust boundaries. Start with the [README](../README.md) for the product and [Demo and evidence](SUBMISSION.md) for the walkthrough.

## Runtime and trust boundaries

The frontend uses `frontend/lib/canton-dapp-ledger-client.ts` to route the HTTP ledger client through the connected Canton wallet SDK. Its local user identity is `wallet:<Party>`. The SDK's active primary Party must match the room wallet; authorization comes from the wallet/ledger, not from a URL.

On DevNet, the additional `devnet-wallet.ts` facade routes through same-origin `/api/devnet`. Each user signs in against the fixed NODERS OIDC endpoint; the server verifies `/v2/authenticated-user` and `CanActAs` rights before returning any Party. Access tokens are sealed with AES-256-GCM in an HttpOnly, SameSite=Strict cookie, with Secure on HTTPS, for at most one hour or the token expiry. Passwords and refresh tokens are not retained. The server session key is never public. Logout clears the cookie; expired/revoked access requires sign-in again. A two-second UI status cache avoids duplicate connection checks, while every actual ledger operation rechecks user rights.

This route trusts VINSS's server and the NODERS participant to act for the selected sandbox Party. It is **not independently signed, self-custody wallet authorization**. A prepare request creates a short-lived encrypted approval ticket bound to the exact command envelope, authenticated user and selected Party; the UI asks before execute. Tickets do not replace a user's cryptographic signature. Commands receive the verified ledger user ID and only the selected Party in `actAs`/`readAs`. Reads and CC registry requests have fixed endpoint allowlists; tokens are never forwarded to arbitrary hosts. Normal wallets retain their own approval/signing paths.

The DevNet CC admin is discovered from the authenticated validator scan proxy. Only explicitly selected CC/Amulet uses its authenticated registry. CBTC keeps its own admin and registrar; no asset substitution occurs. Token registry availability, DAR vetting, balance and two-user visibility remain external requirements. A timed-out submission may have committed; reconcile ledger state before retrying.

`BrowserOpenMlsBridge` uses the bundled wasm-bindgen OpenMLS build in `frontend/lib/openmls/`. The Rust source lives in `wasm/vinss_mls/`. No custom encryption algorithm substitutes for MLS. Each browser installation creates its own MLS signing identity and KeyPackages; Canton wallet signing keys are separate.

The browser is trusted with plaintext and MLS secrets. Canton transports ciphertext, signed KeyPackage advertisements, Welcome/Commit and visible metadata. Canton also stores canonical business records. The optional memory/HTTP relay implementations are core/test alternatives, not the frontend's current network path.

## Storage, exactly

| Store/code | Contents and scope |
| --- | --- |
| `IndexedDbPlaintextStore`, database `vinss-message-history` | Entire successfully sent/decrypted `PlainMessage`, including private offer terms/actions. Local plaintext history. Key uses network + active Party + installation + conversation + message ID. Includes processing markers for encrypted group-state envelopes. |
| `IndexedDbOpenMlsCheckpointStore`, database `vinss-openmls` | Provider storage, identity and group/ratchet state, pending outbound membership changes and processed handshake IDs, keyed by installation. AES-GCM at rest with a stored non-exportable CryptoKey. |
| `localStorage`, `vinss:installation:*` | Stable wallet-scoped installation IDs; preserves a prior advanced-form installation when not claimed by another wallet. |
| `localStorage`, `vinss:invite:v1:*` | Creator's original invite descriptor/secret, network and Party scoped. |
| `localStorage`, `vinss:rooms:v1:*` | Room navigation bookmarks only, network and Party scoped. |
| `BrowserCantonLiveStateStore` | Ledger/message cursors, namespaced by network and active conversation, then Party/installation. |

Private room connect restores cached messages, offers and actions before live subscription. Group connect restores cached plaintext and the encrypted MLS checkpoint. Text and encrypted group-state replay use local message IDs/processing markers to avoid consuming the same MLS generation again.

The encrypted checkpoint and plaintext history use separate transactions/databases. They are **not atomic together**: a crash or storage error between MLS ratchet persistence and history persistence can still lose recoverability of that message. The code does not promise recovery after clearing, corrupting or rolling back site storage. Plaintext history is readable by code running on this origin and by someone with access to the browser profile; encryption of MLS checkpoints does not encrypt that history.

Local history applies to messages sent or decrypted after the history feature was installed. Messages already consumed by older releases without local history cannot be restored automatically from ledger ciphertext after their MLS generations have been deleted.

## Invite binding and QR

`frontend/lib/canton-invite.ts` creates a version-1 descriptor with UUID conversation ID, random secret, host Party/installation, network, title and 24-hour expiry. `kind: "group"` distinguishes group invitations; existing private descriptors remain compatible.

The URL is `/invite#<base64url descriptor>`. The fragment is not included in an ordinary HTTP request, but anyone with the full link/QR has the invitation capability. The URL is not cryptographically signed. Changing a descriptor does not authorize the holder as its host or resolve a forged Party: the creator's private invite flow also checks the exact descriptor saved in the original browser, and group admission uses the original saved descriptor.

Joining creates `Vinss.Messaging:KeyPackageRequest` with:

- `requestId = vinss-invite:v1:<SHA-256(conversation ID + ':' + secret)>`
- requester as Canton signatory, recipient as host observer, and the guest installation.

This signed request supplies the creator's Party/installation binding. The messaging runtime publishes real KeyPackages as `KeyPackageOffer`; the authenticated directory verifies their signed owners and unexpired bindings before admitting a guest. New invite/job bookmarks carry the signed request ID to the room. Admission requires the peer KeyPackage advertisement to be newer than that registration, so an older single-use KeyPackage from another room is not selected during the join race. Private admission selects the earliest matching request. Advanced/manual legacy connections without a registration ID retain the original advertisement selection. Group admission deduplicates signed requests by Party and installation and limits the UI group to 32 members.

`InviteQr.tsx` renders the exact link in the browser using `qrcode`, medium error correction, four-module quiet zone and a white background. It offers a 640-pixel PNG download. Over-capacity QR generation reports an error and leaves Copy link available. Scanning uses the phone camera; there is no in-app camera scanner or QRIS payment integration.

Expiry is checked by the client when joining/admitting; it is not a ledger-side invitation expiry rule. Existing admitted rooms can continue after invite expiry. Revocation, renewal, transfer of creator devices and recovery across devices are not implemented.

## Canton messaging and ordering

`CantonMessagingTransport` writes these templates from `daml/Vinss/Messaging.daml`:

| Template | Authority/visibility | Payload |
| --- | --- | --- |
| `KeyPackageRequest` | Requester signatory, host recipient observer | Installation binding and hashed request ID |
| `KeyPackageOffer` | Owner signatory, requester observer | Public MLS KeyPackage, installation, expiry |
| `MlsDelivery` | Sender signatory, recipient observer | MLS Welcome or Commit bytes in base64 |
| `EncryptedMessage` | Sender signatory, recipients observers | MLS application ciphertext in base64; public envelope metadata |

The frontend's Canton provider uses `fetchConversationEvents` to interleave Welcome, application ciphertext and Commit **in ledger order for the active conversation**. Processing all commits before older application messages can delete the needed generations; the delayed-reader integration scenario verifies the ordered path. Relay transports without that API retain the existing handshake-first path and are not the frontend Canton path.

Frontend transports validate each event's signed Canton sender against the expected Party for its installation. Private rooms know the two bindings; groups start with the host and signed guest requests, then resolve existing member Parties from decrypted group metadata. Encrypted group-state payloads are accepted only from the configured creator installation. Message IDs, conversation IDs, installation IDs and epochs are checked against the encrypted payload/envelope. This is not an independent security audit or a promise of protection from a malicious admitted member changing their own application data.

`CantonLiveMessagingSession` filters the active conversation and persists cursors only after delivery callbacks succeed. The wallet polling stream likewise advances its offset only after a successful batch callback and retries on processing errors. Private-room migration copies only an existing legacy per-room message cursor; it does not reuse the old global ledger offset or replay already-consumed old ciphertext. Room-scoped live offsets avoid a visit to one room causing another room's messages to be skipped.

## Groups and private rooms

`CantonRoomRuntime` serializes local MLS mutations/sync/send and retries creator admission when ledger updates arrive. It serves two-person chat/offer rooms at `/room/[roomId]`. `CantonGroupRuntime` serves `/group/[roomId]`, maintains a serial queue for local MLS mutation/sync/send, and checks pending signed registrations every five seconds. The host must keep the original group browser open to admit guests. Guest pages show Waiting until the host's real MLS Welcome and encrypted membership state arrive.

Membership metadata (title, roles, Party credentials and installation roster) travels as encrypted `group_state`. MLS add/remove operations rekey epochs. Core member removal is tested, but the group UI only supports admission, messaging and member display; it has no member-removal/ban interface, attachments or group escrow. Replies/reactions/receipts/attachments exist as typed core content, not a complete group UI.

Multiple browser tabs or simultaneously active runtimes for the same installation do not have a cross-tab MLS write lock. Use one active room tab per installation for the demo. Device linking, durable pending-message outbox/reconciliation and offline delivery guarantees are not implemented; a successful submit followed by a local storage failure can leave an on-ledger message that the UI reported as failed. Retry sending can produce a new message ID. Canton transaction acknowledgements must be checked before assuming a message/offer succeeded.

## Deal & Escrow (Rekber)

The [escrow guide](ESCROW.md) maps every template, authorized actor and funding check in this workflow.

The frontend sends canonical private terms inside MLS `deal_proposal`; `Vinss.Deal:DealProposal` stores their hash, amount, instrument, Parties, expiry and optional `instrumentAdmin`. `deal_action` chat content reports workflow changes; it is not itself ledger authorization. UI actions use `HttpCantonOfferProvider` and verify the referenced proposal contract before acceptance.

The implemented escrow uses Canton Token Standard (CIP-56), not the old custom `CashHolding`/custodian IOU model:

1. Buyer accepts the proposal, creating `DealAgreement`.
2. For an agreed registry `instrumentAdmin`, the payer/reviewer wallet creates a Token Standard Allocation. `FundEscrow` validates its instrument/admin, amount, payer/payee/executor and deal reference and creates `DealEscrow`.
3. Fulfiller submits funded fulfillment; reviewer approves or requests revision.
4. After approval, fulfiller exercises `FulfillmentApproval.Settle`. The contract exercises the standard Allocation's `Allocation_ExecuteTransfer`, then creates `SettlementReceipt` with receiver holding references.

VINSS contracts reference the Allocation; VINSS does not custody funds. A proposal without `instrumentAdmin` has no Canton escrow to settle. CC registry admin/URLs must match the selected network. `acceptOffer` performs acceptance and allocation/funding as separate wallet steps, so an accepted agreement does not prove funding if the second step fails.

`daml/Vinss/Deal.daml` has no dispute/arbitration or refund choice. There is no group deal settlement. Local tests cover provider/registry choices and the explicit demo UI; the separate DevNet runbook records an earlier real settlement, not proof of a fresh live run of the current release.

## Marketplace and planned features

Jobs currently come from validated `frontend/data/jobs.json`, with search/category/pagination via `/api/jobs`; this is not an open job-publishing backend. Each real application creates a signed `KeyPackageRequest` and a new private conversation. The job supplies an offer draft; submitting the actual offer still requires user action and wallet authorization.

`?demo=1` sample jobs and `/demo` are explicitly labeled previews with no real settlement. Points and VIP are Coming soon. Multichain is planned. None are represented as already active.

## 2026-10-09 wallet and recovery boundary

SDK initialization registers CIP-103 extensions, configured/recent HTTPS gateways and optional Canton WalletConnect. The app excludes the SDK's development-only localhost default. Account/connection events update usable sessions. Authenticated `status` must report a connected network matching the deployment; account Party must be allocated and enabled on that network. Ledger requests revalidate the connection/network before delegating to wallet authorization. Primary account selection remains in the wallet.

A VINSS `DappSDK` instance applies network policy before the SDK picker opens: published Send Connect is excluded on DevNet; Grofty is enabled only on MainNet. Other providers still need actual network validation. An explicit gateway choice restricts the picker to the configured RemoteAdapter; it cannot silently choose an installed extension. Missing gateway access is shown in the chooser and diagnostics. The NODERS sandbox's Splice web wallet/JSON Ledger API are distinct from a CIP-103 Wallet Gateway; external-wallet approval still requires a compatible signing provider. The separate HackCanton browser login uses the node-hosted HTTP authorization route described above.

`/connect-test` exposes only configuration presence, network, approved Party and an explicit read-only ledger-offset check; it does not print SDK status/session objects containing credentials. This is diagnostic code, not evidence of a successful external wallet connection.

Funding recovery looks up the active agreement and checks its terms; existing compatible, unexpired allocations can be reused. The payer UI exposes retry and disables unfunded delivery. See [Escrow](ESCROW.md). There is no current DecMan module or deployed shared VINSS Party; see [BitSafe Gold](BITSAFE_GOLD.md).

## Grofty connection addition

The chooser adds official `@groftylabs/dapp-sdk` 0.2.0 alongside the existing Canton SDK/gateway/WalletConnect routes. Grofty Wallet 2.0.4+ is required and reports `canton:da-mainnet`; DevNet deployments reject it. The direct provider path does not establish Chrome Android pairing or complete escrow compatibility: `/v2/updates` and interface-view support remain limitations. See [wallet setup](./WALLET_SETUP.md) for behavior, recovery and verification status.
