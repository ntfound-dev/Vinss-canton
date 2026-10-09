# Canton DevNet E2E Escrow Runbook

> Historical settlement evidence from 2026-10-06, separate from the current messaging verification. Current code architecture is described in [ARCHITECTURE.md](ARCHITECTURE.md); current messaging checks and the opt-in live runner are in [MESSAGING_E2E.md](MESSAGING_E2E.md).

This document records the VINSS end-to-end escrow flow verified against the HackCanton shared Canton DevNet on **2026-10-06**.

```text
DealProposal
  -> Accept
DealAgreement
  -> CIP-56 AllocationFactory_Allocate
  -> FundEscrow
DealEscrow
  -> SubmitFundedFulfillment
DealFulfillment
  -> Approve
FulfillmentApproval
  -> Allocation_ExecuteTransfer
  -> Settle
SettlementReceipt
```

The verified run moved **1.0000000000 Amulet (Canton Coin on this DevNet)** from the payer to the freelancer and produced a VINSS `SettlementReceipt`.

> Never commit access tokens, refresh tokens, passwords, or AppsFactory credentials to this repository.

## Network

```bash
export LEDGER='https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services'
export VALIDATOR_API='https://validator-api-http.validator.hackcanton-01.devnet.naas.noders.services'
export REGISTRY_BASE="$VALIDATOR_API/api/validator/v0/scan-proxy"
```

VINSS DAR:

```text
name: vinss-canton-messaging
version: 0.1.0
package id: df0ac35b69a20ade2826a07d692ea4bb5db5941f1fafd3376c117815c74ae4ba
status: PACKAGE_STATUS_REGISTERED
```

The DAR must be uploaded and vetted on the participant first.

## Required runtime variables

```bash
export TOKEN='<ledger-access-token>'
export USER_ID='<authenticated-ledger-user-id>'

# payer / client / reviewer
export REAL_CLIENT='<payer-party-id>'

# payee / freelancer / fulfiller
export REAL_FREELANCER='<payee-party-id>'
```

For a single-account smoke test, both parties must be usable by the authenticated ledger user.

## 1. Discover the Canton Coin admin

```bash
curl -sS \
  "$VALIDATOR_API/api/validator/v0/scan-proxy/dso-party-id" \
  -H "Authorization: Bearer $TOKEN"
```

Verified DevNet DSO:

```text
DSO::1220be58c29e65de40bf273be1dc2b266d43a9a002ea5b18955aeef7aac881bb471a
```

```bash
export CC_ADMIN='DSO::1220be58c29e65de40bf273be1dc2b266d43a9a002ea5b18955aeef7aac881bb471a'
```

Canton Coin appears through Token Standard holdings as:

```text
instrumentId.admin = $CC_ADMIN
instrumentId.id    = Amulet
```

## 2. Confirm the payer has an unlocked Amulet holding

Get the current ledger end:

```bash
export OFFSET="$(
  curl -sS \
    -H "Authorization: Bearer $TOKEN" \
    "$LEDGER/v2/state/ledger-end" |
  node -e '
let s="";
process.stdin.on("data",d=>s+=d);
process.stdin.on("end",()=>process.stdout.write(String(JSON.parse(s).offset)));
'
)"
```

Query the Token Standard Holding interface for the payer:

```bash
curl -sS \
  -X POST \
  "$LEDGER/v2/state/active-contracts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @- <<EOFJSON
{
  "activeAtOffset": $OFFSET,
  "eventFormat": {
    "filtersByParty": {
      "$REAL_CLIENT": {
        "cumulative": [
          {
            "identifierFilter": {
              "InterfaceFilter": {
                "value": {
                  "interfaceId": "#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding",
                  "includeInterfaceView": true,
                  "includeCreatedEventBlob": true
                }
              }
            }
          }
        ]
      }
    },
    "verbose": false
  }
}
EOFJSON
```

Select fresh, unlocked holdings where:

```text
owner              == REAL_CLIENT
instrumentId.admin == CC_ADMIN
instrumentId.id    == "Amulet"
lock                == null
sum(amount)         >= deal amount
```

Do not cache the Holding CID for long. Wallet activity may consume it and create a replacement holding.

## 3. Create an escrow-enabled DealProposal

Freelance roles:

```text
seller    = freelancer
buyer     = client
fulfiller = freelancer
reviewer  = client
```

The proposal must include:

```json
{
  "amount": "1",
  "instrumentId": "Amulet",
  "instrumentAdmin": "DSO::..."
}
```

Create:

```text
template: #vinss-canton-messaging:Vinss.Deal:DealProposal
actAs:    REAL_FREELANCER
```

A successful create returns a `DealProposal` contract ID.

## 4. Client accepts

Exercise:

```text
template: #vinss-canton-messaging:Vinss.Deal:DealProposal
choice:   Accept
actAs:    REAL_CLIENT
```

This archives `DealProposal` and creates `DealAgreement`.

Keep the new `DealAgreement` CID.

## 5. Create the CIP-56 Allocation

The payer creates a Token Standard Allocation before VINSS calls `FundEscrow`.

### 5.1 Build fresh allocation arguments

Use fresh timestamps immediately before submission:

```text
requestedAt    = now
allocateBefore = min(now + 5 minutes, settleBefore - 1 minute)
settleBefore   = VINSS deal expiry
```

Core allocation shape:

```json
{
  "expectedAdmin": "<CC_ADMIN>",
  "allocation": {
    "settlement": {
      "executor": "<REAL_FREELANCER>",
      "settlementRef": {
        "id": "<VINSS_DEAL_ID>",
        "cid": null
      },
      "requestedAt": "<NOW>",
      "allocateBefore": "<NOW_PLUS_5_MIN>",
      "settleBefore": "<DEAL_EXPIRY>",
      "meta": { "values": {} }
    },
    "transferLegId": "vinss-principal",
    "transferLeg": {
      "sender": "<REAL_CLIENT>",
      "receiver": "<REAL_FREELANCER>",
      "amount": "1",
      "instrumentId": {
        "admin": "<CC_ADMIN>",
        "id": "Amulet"
      },
      "meta": { "values": {} }
    }
  },
  "requestedAt": "<NOW>",
  "inputHoldingCids": [
    "<FRESH_UNLOCKED_HOLDING_CID>"
  ],
  "extraArgs": {
    "context": { "values": {} },
    "meta": { "values": {} }
  }
}
```

### 5.2 Request AllocationFactory context

```bash
curl -sS \
  -X POST \
  "$REGISTRY_BASE/registry/allocation-instruction/v1/allocation-factory" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @.allocation-factory-request.json
```

Expected response fields:

```text
factoryId
choiceContext.choiceContextData
choiceContext.disclosedContracts[]
```

### 5.3 Exercise AllocationFactory_Allocate immediately

Replace `extraArgs.context` with the returned `choiceContextData`.

Submit:

```text
template:
#splice-api-token-allocation-instruction-v1:Splice.Api.Token.AllocationInstructionV1:AllocationFactory

choice:
AllocationFactory_Allocate

contractId:
factoryId returned by the registry

actAs:
REAL_CLIENT
```

Include the registry-provided `disclosedContracts` and their `synchronizerId`.

### 5.4 Find the resulting Allocation

Query:

```text
#splice-api-token-allocation-v1:Splice.Api.Token.AllocationV1:Allocation
```

Find the contract whose interface view satisfies:

```text
allocation.settlement.settlementRef.id == VINSS_DEAL_ID
```

Save its CID as `ALLOCATION_CID`.

## 6. Fund VINSS escrow

Exercise:

```text
template: #vinss-canton-messaging:Vinss.Deal:DealAgreement
choice:   FundEscrow
actAs:    REAL_CLIENT
```

Argument:

```json
{
  "allocationCid": "<ALLOCATION_CID>"
}
```

VINSS validates:

- instrument admin
- instrument ID
- exact amount
- settlement reference / deal ID
- sender = reviewer / payer
- receiver = fulfiller / payee
- executor = fulfiller / payee

Success archives `DealAgreement` and creates `DealEscrow` with the same `lockedAllocationCid`.

## 7. Freelancer submits fulfillment

Exercise:

```text
template: #vinss-canton-messaging:Vinss.Deal:DealEscrow
choice:   SubmitFundedFulfillment
actAs:    REAL_FREELANCER
```

Argument:

```json
{
  "fulfillmentHash": "<sha256-of-private-work-proof>"
}
```

The actual work stays private/off-ledger. Canton carries the proof hash and business state.

Success creates `DealFulfillment` with the same `lockedAllocationCid`.

## 8. Client approves fulfillment

Exercise:

```text
template: #vinss-canton-messaging:Vinss.Deal:DealFulfillment
choice:   Approve
actAs:    REAL_CLIENT
```

Success creates `FulfillmentApproval`.

## 9. Get fresh settlement context

```bash
curl -sS \
  -X POST \
  "$REGISTRY_BASE/registry/allocations/v1/$ALLOCATION_CID/choice-contexts/execute-transfer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meta": {},
    "excludeDebugFields": true
  }'
```

Use the returned:

```text
choiceContextData
disclosedContracts[]
```

## 10. Settle

The freelancer/payee exercises:

```text
template: #vinss-canton-messaging:Vinss.Deal:FulfillmentApproval
choice:   Settle
actAs:    REAL_FREELANCER
```

Choice argument:

```json
{
  "extraArgs": {
    "context": "<choiceContextData from registry>",
    "meta": {
      "values": {}
    }
  }
}
```

Include the registry's disclosed contracts and synchronizer ID.

Inside `FulfillmentApproval.Settle`, VINSS exercises Token Standard `Allocation_ExecuteTransfer`. VINSS does not custody the token.

Success creates `Vinss.Deal:SettlementReceipt`.

## 11. Verify the result

Verify all of the following:

1. A live VINSS `SettlementReceipt` exists for the deal.
2. The freelancer owns a new unlocked Amulet Holding.
3. `SettlementReceipt.receiverHoldingCids` contains that exact Holding CID.

Expected final holding shape:

```text
owner: REAL_FREELANCER
amount: 1.0000000000
instrumentId.id: Amulet
instrumentId.admin: CC_ADMIN
lock: null
```

## Verified DevNet run evidence

Verified on **2026-10-06**.

```text
dealId:
freelance-escrow-1791279758

proposal create update:
1220bc06be5ba9a90e208e94b218c7168be7dd30fb871dc1c7df5a93788e639d32a3

accept update:
12206a434f54a94a7887a3b37796eb64b0fe797f5692c1dca0e4473c6f90fe529e7e

allocation update:
1220f62ef8a04b213a0c128e3dc120ae8cd7479ccddd35533fead642260f270c917c

allocation CID:
00437ff87a125a56e7b2798883c694706cd8863501c66df2d57060b608bc9f8e33ca121220437b16b589848e173d637b511983b9535b6a639db159788ade6ddae0908dcfc9

fund escrow update:
1220de7e7afcc885b5b6fb6bb12b464b6aa82780505f86076c42b112da593e3c9cdc

fulfillment update:
122059390cf32c6c5fe22c67a7357dbde607b65d6fb53694cd4fb84b5a47328dabf1

approve update:
12203bb4caec0ad5582e6a74c564b1e577f251adc9ada8855145d9bbe0c220c6dd5e

settlement update:
1220855bf3dc659be03723e344b9dd636b63e019fc436a3d637e0ac3f339f24ad779

SettlementReceipt CID:
0061515c1fe3c04e7ee0e8dcc637e19d4859d2402fb10ef6ed8302b6c9be814f56ca121220f97cdf9ce5d1ad59bc48668fc8dd2048ecc36e48bd4f70c9034c3ec743a69304

receiver Holding CID:
007ae0cf35d12c4abb963a8487ace408aca0ceab87e73cbbde6a8b7b565ffb1396ca12122072302f796169d74d6f098396ac954f0030512af1251ab9fbc6fc4e7be6b8dd98

receiver amount:
1.0000000000 Amulet

receiver lock:
null
```

The receipt's `receiverHoldingCids` contained the exact Holding CID above, confirming the Token Standard settlement completed to the freelancer.

## Troubleshooting observed during the live run

### `deadline-exceeded` for `allocateBefore`

Observed error:

```text
stdlib.daml.com/deadline-exceeded
Ledger time is at or past deadline 'allocation.settlement.allocateBefore'
```

Cause: the factory request was prepared and submitted after its short allocation window had expired.

Fix: regenerate `requestedAt`, `allocateBefore`, factory context, and submit immediately.

### `CONTRACT_NOT_FOUND` for an input Holding

Cause: an old Amulet Holding CID was reused after wallet activity had consumed/replaced it.

Fix: query the Holding interface again, select fresh unlocked holdings, then request a fresh AllocationFactory context and submit immediately.

### Deal has `instrumentAdmin: null`

That is a non-escrow VINSS deal. `FundEscrow` intentionally rejects it.

For Canton Coin escrow:

```text
instrumentId    = Amulet
instrumentAdmin = DSO::<...>
```

## Security and trust boundary

- VINSS stores canonical deal state and hashes on Canton.
- Private chat and work content is encrypted with OpenMLS; Canton messaging contracts carry ciphertext.
- Canton Coin settlement uses the Canton Token Standard.
- VINSS references a Token Standard Allocation; it does not custody user funds itself.
- Authentication credentials are runtime secrets and must never be committed.
- Browser transaction signing should remain delegated to a compatible Canton wallet/signing provider.

## Current-release verification (2026-10-09)

No fresh network execution was performed during the readiness patch. The historical identifiers above were preserved as repository evidence and were not re-queried in this session. They identify Amulet/CC, not cBTC. The current browser wallet approval and full two-user cBTC run are still outstanding.

To reproduce cBTC execution, use two authorized test wallets on the same selected network and follow [TESTING.md](TESTING.md). Confirm the network's actual CBTC instrument/admin and registrar before allocation. Record proposal, acceptance, allocation, funding, delivery, approval and settlement update IDs, allocation CID, receipt CID, receiver Holding CID/amount/admin/instrument and unlocked state. Do not replace CBTC with Amulet and call the outcome cBTC evidence.

Publish only public/safely redacted execution references. Keep wallet/session/ledger credentials private. If a stage fails, record it and stop; do not fill evidence fields from a simulation.
