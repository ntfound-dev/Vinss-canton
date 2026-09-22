# VINSS Canton

Greenfield implementation for the HackCanton version of VINSS.

The original VINSS repository is intentionally untouched.

## Architecture

VINSS Canton separates two responsibilities:

- **Secure Messaging** — VINSS-owned messaging layer, designed around MLS (RFC 9420) concepts.
- **Canton** — deal agreements, business-state transitions, allocation/funding, fulfillment, dispute, settlement, and receipt.

No fake cryptography is included in this scaffold. The browser-facing messaging layer depends on an `OpenMlsBridge` interface; the actual OpenMLS/WASM implementation is the next integration step.

## Why this layout

We want the useful patterns of mature secure messengers without depending on another messaging network:

- group epochs
- add/remove-member rekeying
- installation/device identity
- typed content
- reply/reaction/receipt
- attachment references
- deal-specific message types
- transport that only carries ciphertext

## Repository layout

```text
src/
  messaging/
    types.ts
    content.ts
    policy.ts
    provider.ts
    transport.ts
    openmls/
      bridge.ts
      provider.ts
  canton/
    types.ts
    provider.ts
wasm/
  vinss_mls/
    Cargo.toml
    src/lib.rs
tests/
  messaging-policy.test.ts
```

## Security rule

The transport/backend must never receive MLS private key material or plaintext message content.

Do not replace `OpenMlsBridge` with custom AES/group-key logic.

## Next milestones

1. Compile OpenMLS 0.9.x for browser WASM.
2. Implement identity + KeyPackage lifecycle.
3. Implement create group / join from Welcome.
4. Implement add/remove members and epoch transition.
5. Encrypt/decrypt application messages.
6. Persist MLS state encrypted on the client.
7. Add VINSS relay API for ciphertext + KeyPackages.
8. Add Canton DealProposal / DealAgreement contracts.
