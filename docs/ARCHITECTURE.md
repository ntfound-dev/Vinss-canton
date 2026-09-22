# VINSS Canton Architecture

## Trust boundaries

### Browser
Trusted with plaintext and MLS private state.

Responsibilities:
- create device/installation identity
- generate MLS KeyPackages
- process Welcome + Commit messages
- encrypt outgoing application messages
- decrypt incoming application messages
- keep MLS group state encrypted at rest

### VINSS Relay
Untrusted for message confidentiality.

Allowed:
- ciphertext
- public delivery metadata
- KeyPackages
- MLS handshake payloads
- cursors / sequencing
- attachment ciphertext

Forbidden:
- plaintext
- MLS private key material
- exported unencrypted group state

### Canton
Canonical business state only.

Examples:
- DealProposal
- DealAgreement
- fulfillment proof/hash
- dispute state
- allocation/funding references
- settlement
- receipt

Do not write casual chat messages to Canton.

## Group lifecycle

```text
installation creates KeyPackage
          |
          v
creator creates MLS group (epoch N)
          |
          +---- Add member --> Commit + Welcome --> epoch N+1
          |
          +---- Remove member --> Commit ----------> epoch N+2
          |
          +---- application message encrypted under current epoch
```

## Typed content

VINSS messages are application payloads encrypted by MLS.

Generic:
- text
- reply
- reaction
- read receipt
- attachment reference

VINSS-specific:
- deal proposal
- deal action

`deal_action` is not itself ledger authorization. The UI must still require the user to authorize the Canton transaction.

## Identity

Do not reuse Canton signing keys as MLS encryption/signing identity by default.

Maintain explicit mapping:

```text
VINSS User
  |- Canton Party ID
  `- Messaging installations[]
```

This prevents one cryptographic domain from accidentally becoming a universal key.
