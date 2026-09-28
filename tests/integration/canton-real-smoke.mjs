import assert from "node:assert/strict";
import crypto from "node:crypto";

const BASE =
  process.env.CANTON_BASE_URL ??
  "http://127.0.0.1:7575";

const PACKAGE =
  "vinss-canton-messaging";

const MODULE =
  "Vinss.Messaging";

async function request(
  path,
  init = {},
) {
  const response =
    await fetch(
      `${BASE}${path}`,
      {
        ...init,

        headers: {
          accept:
            "application/json",

          ...(init.body
            ? {
                "content-type":
                  "application/json",
              }
            : {}),

          ...init.headers,
        },
      },
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `${path} -> ${response.status}: ${text}`,
    );
  }

  return text
    ? JSON.parse(text)
    : undefined;
}

async function connectedSynchronizerId() {
  const result =
    await request(
      "/v2/state/connected-synchronizers",
    );

  const synchronizers =
    result?.connectedSynchronizers;

  assert.ok(
    Array.isArray(
      synchronizers,
    ) &&
      synchronizers.length > 0,
    "Canton participant has no connected synchronizer",
  );

  const synchronizerId =
    synchronizers[0]
      ?.synchronizerId;

  assert.equal(
    typeof synchronizerId,
    "string",
    "Connected synchronizer ID is missing",
  );

  return synchronizerId;
}

async function allocateParty(
  hint,
  synchronizerId,
) {
  const result =
    await request(
      "/v2/parties",
      {
        method: "POST",

        body: JSON.stringify({
          partyIdHint: hint,

          identityProviderId:
            "",

          synchronizerId,
        }),
      },
    );

  const party =
    result?.partyDetails?.party;

  assert.equal(
    typeof party,
    "string",
    `party allocation failed: ${hint}`,
  );

  return party;
}

async function ledgerEnd() {
  const result =
    await request(
      "/v2/state/ledger-end",
    );

  return Number(
    result?.offset ?? 0,
  );
}

function wildcard() {
  return {
    cumulative: [
      {
        identifierFilter: {
          WildcardFilter: {
            value: {
              includeCreatedEventBlob:
                false,
            },
          },
        },
      },
    ],
  };
}

async function activeContracts(
  party,
  offset,
) {
  return request(
    "/v2/state/active-contracts",
    {
      method: "POST",

      body: JSON.stringify({
        activeAtOffset:
          offset,

        eventFormat: {
          filtersByParty: {
            [party]:
              wildcard(),
          },

          verbose: false,
        },
      }),
    },
  );
}

function collectCreatedEvents(
  value,
  output = [],
) {
  if (
    value === null ||
    value === undefined
  ) {
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectCreatedEvents(
        item,
        output,
      );
    }

    return output;
  }

  if (
    typeof value !==
      "object"
  ) {
    return output;
  }

  if (
    value.createdEvent &&
    typeof value.createdEvent ===
      "object"
  ) {
    output.push(
      value.createdEvent,
    );
  }

  for (
    const nested
    of Object.values(value)
  ) {
    collectCreatedEvents(
      nested,
      output,
    );
  }

  return output;
}

async function submitCreates(
  actingParty,
  creates,
) {
  return request(
    "/v2/commands/submit-and-wait",
    {
      method: "POST",

      body: JSON.stringify({
        userId:
          "ledger-api-user",

        commandId:
          `vinss-${crypto.randomUUID()}`,

        actAs: [
          actingParty,
        ],

        readAs: [
          actingParty,
        ],

        commands:
          creates.map(
            ({
              templateId,
              createArguments,
            }) => ({
              CreateCommand: {
                templateId,
                createArguments,
              },
            }),
          ),
      }),
    },
  );
}

const synchronizerId =
  await connectedSynchronizerId();

console.log(
  "Synchronizer:",
  synchronizerId,
);

const alice =
  await allocateParty(
    `Alice-${crypto.randomUUID().slice(0, 8)}`,
    synchronizerId,
  );

const bob =
  await allocateParty(
    `Bob-${crypto.randomUUID().slice(0, 8)}`,
    synchronizerId,
  );

const charlie =
  await allocateParty(
    `Charlie-${crypto.randomUUID().slice(0, 8)}`,
    synchronizerId,
  );

console.log(
  "Alice:",
  alice,
);

console.log(
  "Bob:",
  bob,
);

console.log(
  "Charlie:",
  charlie,
);

const channelId =
  `deal-${crypto.randomUUID()}`;

const deliveryId =
  crypto.randomUUID();

const opaqueWelcome =
  Buffer.from(
    "VINSS MLS opaque Welcome bytes",
  ).toString("base64");

const deliveryResult =
  await submitCreates(
    alice,
    [
      {
        templateId:
          `#${PACKAGE}:${MODULE}:MlsDelivery`,

        createArguments: {
          deliveryId,

          channelId,

          sender:
            alice,

          recipient:
            bob,

          senderInstallationId:
            "alice-browser",

          recipientInstallationId:
            "bob-browser",

          kind:
            "welcome",

          payloadB64:
            opaqueWelcome,

          createdAt:
            new Date()
              .toISOString(),
        },
      },
    ],
  );

const deliveryOffset =
  Number(
    deliveryResult
      .completionOffset,
  );

assert.ok(
  deliveryOffset > 0,
);

const bobAcs =
  await activeContracts(
    bob,
    deliveryOffset,
  );

const bobEvents =
  collectCreatedEvents(
    bobAcs,
  );

const bobDelivery =
  bobEvents.find(
    (event) =>
      event
        ?.createArgument
        ?.deliveryId ===
      deliveryId,
  );

assert.ok(
  bobDelivery,
  "Bob cannot see MLS delivery",
);

assert.equal(
  bobDelivery
    .createArgument
    .payloadB64,
  opaqueWelcome,
);

const charlieAcs =
  await activeContracts(
    charlie,
    deliveryOffset,
  );

const charlieEvents =
  collectCreatedEvents(
    charlieAcs,
  );

assert.equal(
  charlieEvents.some(
    (event) =>
      event
        ?.createArgument
        ?.deliveryId ===
      deliveryId,
  ),
  false,
  "Unrelated Charlie can see private MLS delivery",
);

const messageId =
  crypto.randomUUID();

const ciphertext =
  Buffer.from(
    "this-is-opaque-mls-ciphertext",
  ).toString("base64");

const messageResult =
  await submitCreates(
    alice,
    [
      {
        templateId:
          `#${PACKAGE}:${MODULE}:EncryptedMessage`,

        createArguments: {
          messageId,

          channelId,

          sender:
            alice,

          senderInstallationId:
            "alice-browser",

          recipients: [
            bob,
          ],

          epoch:
            "7",

          ciphertextB64:
            ciphertext,

          createdAt:
            new Date()
              .toISOString(),
        },
      },
    ],
  );

const messageOffset =
  Number(
    messageResult
      .completionOffset,
  );

const bobMessageAcs =
  await activeContracts(
    bob,
    messageOffset,
  );

const bobMessageEvents =
  collectCreatedEvents(
    bobMessageAcs,
  );

const encryptedMessage =
  bobMessageEvents.find(
    (event) =>
      event
        ?.createArgument
        ?.messageId ===
      messageId,
  );

assert.ok(
  encryptedMessage,
  "Bob cannot see encrypted message",
);

assert.equal(
  encryptedMessage
    .createArgument
    .ciphertextB64,
  ciphertext,
);

const charlieMessageAcs =
  await activeContracts(
    charlie,
    messageOffset,
  );

const charlieMessageEvents =
  collectCreatedEvents(
    charlieMessageAcs,
  );

assert.equal(
  charlieMessageEvents.some(
    (event) =>
      event
        ?.createArgument
        ?.messageId ===
      messageId,
  ),
  false,
  "Unrelated Charlie can see encrypted message",
);

const end =
  await ledgerEnd();

assert.ok(
  end >= messageOffset,
);

console.log(
  "REAL CANTON MLS DELIVERY: PASS",
);

console.log(
  "REAL CANTON ENCRYPTED MESSAGE: PASS",
);

console.log(
  "UNRELATED PARTY VISIBILITY: BLOCKED",
);

async function submitExercise(
  actingParty,
  input,
) {
  return request(
    "/v2/commands/submit-and-wait",
    {
      method: "POST",

      body: JSON.stringify({
        userId:
          "ledger-api-user",

        commandId:
          `vinss-exercise-${crypto.randomUUID()}`,

        actAs: [
          actingParty,
        ],

        readAs: [
          actingParty,
        ],

        commands: [
          {
            ExerciseCommand: {
              templateId:
                input.templateId,

              contractId:
                input.contractId,

              choice:
                input.choice,

              choiceArgument:
                input.choiceArgument ??
                {},
            },
          },
        ],
      }),
    },
  );
}

const dealId =
  crypto.randomUUID();

const proposalResult =
  await submitCreates(
    alice,
    [
      {
        templateId:
          `#${PACKAGE}:Vinss.Deal:DealProposal`,

        createArguments: {
          dealId,

          conversationId:
            channelId,

          seller:
            alice,

          buyer:
            bob,

          fulfiller:
            bob,

          reviewer:
            alice,

          termsHash:
            crypto
              .createHash("sha256")
              .update(
                "VINSS private deal terms",
              )
              .digest("hex"),

          amount:
            "100",

          instrumentId:
            "TEST-ASSET",

          createdAt:
            new Date()
              .toISOString(),

          expiresAt:
            new Date(
              Date.now() +
                60 * 60 * 1000,
            ).toISOString(),

          // No custodian: this deal keeps the original flow.
          custodian:
            null,
        },
      },
    ],
  );

const proposalOffset =
  Number(
    proposalResult
      .completionOffset,
  );

const bobDealAcs =
  await activeContracts(
    bob,
    proposalOffset,
  );

const bobDealEvents =
  collectCreatedEvents(
    bobDealAcs,
  );

const proposal =
  bobDealEvents.find(
    (event) =>
      event
        ?.createArgument
        ?.dealId ===
      dealId,
  );

assert.ok(
  proposal,
  "Bob cannot see VINSS DealProposal",
);

const charlieDealAcs =
  await activeContracts(
    charlie,
    proposalOffset,
  );

assert.equal(
  collectCreatedEvents(
    charlieDealAcs,
  ).some(
    (event) =>
      event
        ?.createArgument
        ?.dealId ===
      dealId,
  ),
  false,
  "Unrelated Charlie can see VINSS DealProposal",
);

await submitExercise(
  bob,
  {
    templateId:
      `#${PACKAGE}:Vinss.Deal:DealProposal`,

    contractId:
      proposal.contractId,

    choice:
      "Accept",

    choiceArgument: {},
  },
);

const agreementOffset =
  await ledgerEnd();

const bobAgreementAcs =
  await activeContracts(
    bob,
    agreementOffset,
  );

const agreement =
  collectCreatedEvents(
    bobAgreementAcs,
  ).find(
    (event) =>
      event
        ?.createArgument
        ?.dealId ===
        dealId &&
      String(
        event
          ?.templateId ??
          "",
      ).endsWith(
        ":Vinss.Deal:DealAgreement",
      ),
  );

assert.ok(
  agreement,
  "VINSS DealAgreement was not created",
);

console.log(
  "REAL CANTON DEAL PROPOSAL: PASS",
);

console.log(
  "REAL CANTON DEAL ACCEPTANCE: PASS",
);

const fulfillmentHash =
  crypto
    .createHash("sha256")
    .update(
      "VINSS freelance work submission v1",
    )
    .digest("hex");

await submitExercise(
  bob,
  {
    templateId:
      `#${PACKAGE}:Vinss.Deal:DealAgreement`,

    contractId:
      agreement.contractId,

    choice:
      "SubmitFulfillment",

    choiceArgument: {
      fulfillmentHash,
    },
  },
);

const fulfillmentOffset =
  await ledgerEnd();

const fulfillment =
  collectCreatedEvents(
    await activeContracts(
      alice,
      fulfillmentOffset,
    ),
  ).find(
    (event) =>
      event
        ?.createArgument
        ?.dealId ===
        dealId &&
      String(
        event
          ?.templateId ??
          "",
      ).endsWith(
        ":Vinss.Deal:DealFulfillment",
      ),
  );

assert.ok(
  fulfillment,
  "VINSS DealFulfillment was not created",
);

assert.equal(
  fulfillment
    .createArgument
    .fulfillmentHash,
  fulfillmentHash,
);

const reviewHash =
  crypto
    .createHash("sha256")
    .update(
      "VINSS revision request v1",
    )
    .digest("hex");

await submitExercise(
  alice,
  {
    templateId:
      `#${PACKAGE}:Vinss.Deal:DealFulfillment`,

    contractId:
      fulfillment.contractId,

    choice:
      "RequestRevision",

    choiceArgument: {
      reviewHash,
    },
  },
);

const revisionOffset =
  await ledgerEnd();

const revisionRequest =
  collectCreatedEvents(
    await activeContracts(
      bob,
      revisionOffset,
    ),
  ).find(
    (event) =>
      event
        ?.createArgument
        ?.dealId ===
        dealId &&
      String(
        event
          ?.templateId ??
          "",
      ).endsWith(
        ":Vinss.Deal:DealRevisionRequest",
      ),
  );

assert.ok(
  revisionRequest,
  "VINSS DealRevisionRequest was not created",
);

const revisedFulfillmentHash =
  crypto
    .createHash("sha256")
    .update(
      "VINSS freelance work submission v2",
    )
    .digest("hex");

await submitExercise(
  bob,
  {
    templateId:
      `#${PACKAGE}:Vinss.Deal:DealRevisionRequest`,

    contractId:
      revisionRequest
        .contractId,

    choice:
      "SubmitRevision",

    choiceArgument: {
      fulfillmentHash:
        revisedFulfillmentHash,
    },
  },
);

const revisedOffset =
  await ledgerEnd();

const revisedFulfillment =
  collectCreatedEvents(
    await activeContracts(
      alice,
      revisedOffset,
    ),
  ).find(
    (event) =>
      event
        ?.createArgument
        ?.dealId ===
        dealId &&
      String(
        event
          ?.templateId ??
          "",
      ).endsWith(
        ":Vinss.Deal:DealFulfillment",
      ),
  );

assert.ok(
  revisedFulfillment,
  "VINSS revised DealFulfillment was not created",
);

assert.equal(
  revisedFulfillment
    .createArgument
    .fulfillmentHash,
  revisedFulfillmentHash,
);

await submitExercise(
  alice,
  {
    templateId:
      `#${PACKAGE}:Vinss.Deal:DealFulfillment`,

    contractId:
      revisedFulfillment
        .contractId,

    choice:
      "Approve",

    choiceArgument: {},
  },
);

const approvalOffset =
  await ledgerEnd();

const approval =
  collectCreatedEvents(
    await activeContracts(
      bob,
      approvalOffset,
    ),
  ).find(
    (event) =>
      event
        ?.createArgument
        ?.dealId ===
        dealId &&
      String(
        event
          ?.templateId ??
          "",
      ).endsWith(
        ":Vinss.Deal:FulfillmentApproval",
      ),
  );

assert.ok(
  approval,
  "VINSS FulfillmentApproval was not created",
);

console.log(
  "REAL CANTON FREELANCE FULFILLMENT: PASS",
);

console.log(
  "REAL CANTON FULFILLMENT REVISION: PASS",
);

console.log(
  "REAL CANTON FULFILLMENT APPROVAL: PASS",
);

console.log(
  "UNRELATED DEAL VISIBILITY: BLOCKED",
);

// ---------------------------------------------------------------
// VINSS Canton escrow
//
// Deals that name a custodian are funded with a custodian-issued
// holding, deliver against the escrow and can only pay out through
// an approved fulfillment.
// ---------------------------------------------------------------

const dealTemplate = (name) =>
  `#${PACKAGE}:Vinss.Deal:${name}`;

const custodyTemplate = (name) =>
  `#${PACKAGE}:Vinss.Custody:${name}`;

const digestOf = (value) =>
  crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");

async function submitExerciseAs(
  actAs,
  input,
) {
  return request(
    "/v2/commands/submit-and-wait",
    {
      method: "POST",

      body: JSON.stringify({
        userId:
          "ledger-api-user",

        commandId:
          `vinss-exercise-${crypto.randomUUID()}`,

        actAs,

        readAs:
          actAs,

        commands: [
          {
            ExerciseCommand: {
              templateId:
                input.templateId,

              contractId:
                input.contractId,

              choice:
                input.choice,

              choiceArgument:
                input.choiceArgument ??
                {},
            },
          },
        ],
      }),
    },
  );
}

async function mustFail(
  label,
  action,
) {
  try {
    await action();
  } catch (error) {
    console.log(
      `  rejected as expected: ${label} (${String(
        error?.message,
      ).slice(0, 140)})`,
    );

    return;
  }

  assert.fail(
    `${label} unexpectedly succeeded`,
  );
}

async function findActive(
  party,
  suffix,
  predicate = () => true,
) {
  const offset =
    await ledgerEnd();

  return collectCreatedEvents(
    await activeContracts(
      party,
      offset,
    ),
  ).find(
    (event) =>
      String(
        event?.templateId ??
          "",
      ).endsWith(suffix) &&
      predicate(
        event?.createArgument ??
          {},
      ),
  );
}

async function issueHolding(
  issuer,
  owner,
  holdingId,
  amount,
) {
  await submitCreates(
    issuer,
    [
      {
        templateId:
          custodyTemplate(
            "CashHolding",
          ),

        createArguments: {
          holdingId,

          custodian:
            issuer,

          owner,
          amount,

          instrumentId:
            "USD",
        },
      },
    ],
  );

  const holding =
    await findActive(
      owner,
      ":Vinss.Custody:CashHolding",
      (args) =>
        args.holdingId ===
        holdingId,
    );

  assert.ok(
    holding,
    `CashHolding was not created: ${holdingId}`,
  );

  return holding;
}

const custodian =
  await allocateParty(
    `Custodian-${crypto.randomUUID().slice(0, 8)}`,
    synchronizerId,
  );

const mallory =
  await allocateParty(
    `Mallory-${crypto.randomUUID().slice(0, 8)}`,
    synchronizerId,
  );

const runId =
  crypto
    .randomUUID()
    .slice(0, 8);

const escrowDealId =
  crypto.randomUUID();

const depositId =
  `deposit-${runId}`;

const shortDepositId =
  `short-${runId}`;

const forgedDepositId =
  `forged-${runId}`;

// alice sells and delivers (fulfiller), bob pays and approves (reviewer).
const deposit =
  await issueHolding(
    custodian,
    bob,
    depositId,
    "100",
  );

const shortDeposit =
  await issueHolding(
    custodian,
    bob,
    shortDepositId,
    "99",
  );

const forgedDeposit =
  await issueHolding(
    mallory,
    bob,
    forgedDepositId,
    "100",
  );

const holdingIs = (holdingId) =>
  (args) =>
    args.holdingId ===
    holdingId;

assert.equal(
  await findActive(
    alice,
    ":Vinss.Custody:CashHolding",
    holdingIs(depositId),
  ),
  undefined,
  "payee must not see the payer's holding",
);

assert.equal(
  await findActive(
    charlie,
    ":Vinss.Custody:CashHolding",
    holdingIs(depositId),
  ),
  undefined,
  "unrelated party must not see the holding",
);

await submitCreates(
  alice,
  [
    {
      templateId:
        dealTemplate(
          "DealProposal",
        ),

      createArguments: {
        dealId:
          escrowDealId,

        conversationId:
          channelId,

        seller:
          alice,

        buyer:
          bob,

        fulfiller:
          alice,

        reviewer:
          bob,

        termsHash:
          digestOf(
            "VINSS escrow deal terms",
          ),

        amount:
          "100",

        instrumentId:
          "USD",

        createdAt:
          new Date()
            .toISOString(),

        expiresAt:
          new Date(
            Date.now() +
              60 * 60 * 1000,
          ).toISOString(),

        custodian,
      },
    },
  ],
);

const escrowProposal =
  await findActive(
    bob,
    ":Vinss.Deal:DealProposal",
    (args) =>
      args.dealId ===
      escrowDealId,
  );

assert.ok(
  escrowProposal,
  "VINSS escrow DealProposal was not created",
);

await submitExercise(
  bob,
  {
    templateId:
      dealTemplate(
        "DealProposal",
      ),

    contractId:
      escrowProposal.contractId,

    choice:
      "Accept",

    choiceArgument: {},
  },
);

const escrowAgreement =
  await findActive(
    bob,
    ":Vinss.Deal:DealAgreement",
    (args) =>
      args.dealId ===
      escrowDealId,
  );

assert.ok(
  escrowAgreement,
  "VINSS escrow DealAgreement was not created",
);

assert.equal(
  escrowAgreement
    .createArgument
    .custodian,
  custodian,
);

assert.equal(
  await findActive(
    custodian,
    ":Vinss.Deal:DealAgreement",
    (args) =>
      args.dealId ===
      escrowDealId,
  ),
  undefined,
  "custodian must not see the deal contracts",
);

const escrowWorkHash =
  digestOf(
    "VINSS escrow work v1",
  );

const agreementTemplate =
  dealTemplate(
    "DealAgreement",
  );

await mustFail(
  "SubmitFulfillment before the escrow is funded",
  () =>
    submitExercise(
      alice,
      {
        templateId:
          agreementTemplate,

        contractId:
          escrowAgreement
            .contractId,

        choice:
          "SubmitFulfillment",

        choiceArgument: {
          fulfillmentHash:
            escrowWorkHash,
        },
      },
    ),
);

await mustFail(
  "FundEscrow with a holding issued by someone else",
  () =>
    submitExercise(
      bob,
      {
        templateId:
          agreementTemplate,

        contractId:
          escrowAgreement
            .contractId,

        choice:
          "FundEscrow",

        choiceArgument: {
          holdingCid:
            forgedDeposit
              .contractId,
        },
      },
    ),
);

await mustFail(
  "FundEscrow with a holding of the wrong amount",
  () =>
    submitExercise(
      bob,
      {
        templateId:
          agreementTemplate,

        contractId:
          escrowAgreement
            .contractId,

        choice:
          "FundEscrow",

        choiceArgument: {
          holdingCid:
            shortDeposit
              .contractId,
        },
      },
    ),
);

await mustFail(
  "FundEscrow by the payee",
  () =>
    submitExercise(
      alice,
      {
        templateId:
          agreementTemplate,

        contractId:
          escrowAgreement
            .contractId,

        choice:
          "FundEscrow",

        choiceArgument: {
          holdingCid:
            deposit
              .contractId,
        },
      },
    ),
);

await submitExercise(
  bob,
  {
    templateId:
      agreementTemplate,

    contractId:
      escrowAgreement
        .contractId,

    choice:
      "FundEscrow",

    choiceArgument: {
      holdingCid:
        deposit.contractId,
    },
  },
);

const escrow =
  await findActive(
    alice,
    ":Vinss.Deal:DealEscrow",
    (args) =>
      args.dealId ===
      escrowDealId,
  );

assert.ok(
  escrow,
  "VINSS DealEscrow was not created",
);

const lockedHolding =
  await findActive(
    bob,
    ":Vinss.Custody:LockedHolding",
    (args) =>
      args.dealId ===
      escrowDealId,
  );

assert.ok(
  lockedHolding,
  "VINSS LockedHolding was not created",
);

assert.equal(
  lockedHolding
    .createArgument
    .payer,
  bob,
);

assert.equal(
  lockedHolding
    .createArgument
    .payee,
  alice,
);

assert.equal(
  lockedHolding
    .createArgument
    .amount,
  "100",
);

assert.equal(
  escrow
    .createArgument
    .lockedHoldingCid,
  lockedHolding.contractId,
);

assert.equal(
  await findActive(
    bob,
    ":Vinss.Custody:CashHolding",
    holdingIs(depositId),
  ),
  undefined,
  "the funded holding must be consumed",
);

assert.ok(
  await findActive(
    custodian,
    ":Vinss.Custody:LockedHolding",
    (args) =>
      args.dealId ===
      escrowDealId,
  ),
  "custodian must see the locked holding",
);

assert.equal(
  await findActive(
    custodian,
    ":Vinss.Deal:DealEscrow",
    (args) =>
      args.dealId ===
      escrowDealId,
  ),
  undefined,
  "custodian must not see the escrow deal",
);

assert.equal(
  await findActive(
    charlie,
    ":Vinss.Custody:LockedHolding",
    (args) =>
      args.dealId ===
      escrowDealId,
  ),
  undefined,
  "unrelated party must not see the locked holding",
);

console.log(
  "REAL CANTON ESCROW FUNDING: PASS",
);

await submitExercise(
  alice,
  {
    templateId:
      dealTemplate(
        "DealEscrow",
      ),

    contractId:
      escrow.contractId,

    choice:
      "SubmitFundedFulfillment",

    choiceArgument: {
      fulfillmentHash:
        escrowWorkHash,
    },
  },
);

const escrowFulfillment =
  await findActive(
    bob,
    ":Vinss.Deal:DealFulfillment",
    (args) =>
      args.dealId ===
      escrowDealId,
  );

assert.ok(
  escrowFulfillment,
  "VINSS escrow DealFulfillment was not created",
);

assert.equal(
  escrowFulfillment
    .createArgument
    .lockedHoldingCid,
  lockedHolding.contractId,
);

await submitExercise(
  bob,
  {
    templateId:
      dealTemplate(
        "DealFulfillment",
      ),

    contractId:
      escrowFulfillment
        .contractId,

    choice:
      "RequestRevision",

    choiceArgument: {
      reviewHash:
        digestOf(
          "VINSS escrow review v1",
        ),
    },
  },
);

const escrowRevision =
  await findActive(
    alice,
    ":Vinss.Deal:DealRevisionRequest",
    (args) =>
      args.dealId ===
      escrowDealId,
  );

assert.ok(
  escrowRevision,
  "VINSS escrow DealRevisionRequest was not created",
);

assert.equal(
  escrowRevision
    .createArgument
    .lockedHoldingCid,
  lockedHolding.contractId,
);

await submitExercise(
  alice,
  {
    templateId:
      dealTemplate(
        "DealRevisionRequest",
      ),

    contractId:
      escrowRevision
        .contractId,

    choice:
      "SubmitRevision",

    choiceArgument: {
      fulfillmentHash:
        digestOf(
          "VINSS escrow work v2",
        ),
    },
  },
);

const revisedEscrowFulfillment =
  await findActive(
    bob,
    ":Vinss.Deal:DealFulfillment",
    (args) =>
      args.dealId ===
      escrowDealId,
  );

assert.ok(
  revisedEscrowFulfillment,
  "VINSS revised escrow DealFulfillment was not created",
);

assert.equal(
  Number(
    revisedEscrowFulfillment
      .createArgument
      .round,
  ),
  1,
);

assert.equal(
  revisedEscrowFulfillment
    .createArgument
    .lockedHoldingCid,
  lockedHolding.contractId,
);

await submitExercise(
  bob,
  {
    templateId:
      dealTemplate(
        "DealFulfillment",
      ),

    contractId:
      revisedEscrowFulfillment
        .contractId,

    choice:
      "Approve",

    choiceArgument: {},
  },
);

const escrowApproval =
  await findActive(
    alice,
    ":Vinss.Deal:FulfillmentApproval",
    (args) =>
      args.dealId ===
      escrowDealId,
  );

assert.ok(
  escrowApproval,
  "VINSS escrow FulfillmentApproval was not created",
);

assert.equal(
  escrowApproval
    .createArgument
    .lockedHoldingCid,
  lockedHolding.contractId,
);

// The work is approved but not yet settled. Neither party may move the
// locked funds on their own, and the payer cannot settle for the payee.
const lockedTemplate =
  custodyTemplate(
    "LockedHolding",
  );

const approvalTemplate =
  dealTemplate(
    "FulfillmentApproval",
  );

await mustFail(
  "payee releasing the locked holding alone",
  () =>
    submitExercise(
      alice,
      {
        templateId:
          lockedTemplate,

        contractId:
          lockedHolding
            .contractId,

        choice:
          "ReleaseToPayee",

        choiceArgument: {},
      },
    ),
);

await mustFail(
  "payer releasing the locked holding alone",
  () =>
    submitExercise(
      bob,
      {
        templateId:
          lockedTemplate,

        contractId:
          lockedHolding
            .contractId,

        choice:
          "ReleaseToPayee",

        choiceArgument: {},
      },
    ),
);

await mustFail(
  "payer settling on the payee's behalf",
  () =>
    submitExercise(
      bob,
      {
        templateId:
          approvalTemplate,

        contractId:
          escrowApproval
            .contractId,

        choice:
          "Settle",

        choiceArgument: {},
      },
    ),
);

await submitExercise(
  alice,
  {
    templateId:
      approvalTemplate,

    contractId:
      escrowApproval
        .contractId,

    choice:
      "Settle",

    choiceArgument: {},
  },
);

const receipt =
  await findActive(
    alice,
    ":Vinss.Deal:SettlementReceipt",
    (args) =>
      args.dealId ===
      escrowDealId,
  );

assert.ok(
  receipt,
  "VINSS SettlementReceipt was not created",
);

const releasedHolding =
  await findActive(
    alice,
    ":Vinss.Custody:CashHolding",
    holdingIs(
      `${depositId}:released`,
    ),
  );

assert.ok(
  releasedHolding,
  "the payee must receive the released holding",
);

assert.equal(
  releasedHolding
    .createArgument
    .owner,
  alice,
);

assert.equal(
  releasedHolding
    .createArgument
    .custodian,
  custodian,
);

assert.equal(
  releasedHolding
    .createArgument
    .amount,
  "100",
);

assert.equal(
  receipt
    .createArgument
    .releasedHoldingCid,
  releasedHolding.contractId,
);

assert.ok(
  await findActive(
    bob,
    ":Vinss.Deal:SettlementReceipt",
    (args) =>
      args.dealId ===
      escrowDealId,
  ),
  "the payer must see the settlement receipt",
);

assert.equal(
  await findActive(
    bob,
    ":Vinss.Custody:LockedHolding",
    (args) =>
      args.dealId ===
      escrowDealId,
  ),
  undefined,
  "the locked holding must be consumed",
);

assert.equal(
  await findActive(
    charlie,
    ":Vinss.Deal:SettlementReceipt",
    (args) =>
      args.dealId ===
      escrowDealId,
  ),
  undefined,
  "unrelated party must not see the receipt",
);

await mustFail(
  "settling the same approval twice",
  () =>
    submitExercise(
      alice,
      {
        templateId:
          approvalTemplate,

        contractId:
          escrowApproval
            .contractId,

        choice:
          "Settle",

        choiceArgument: {},
      },
    ),
);

console.log(
  "REAL CANTON ESCROW SETTLEMENT: PASS",
);

// A deal without a custodian keeps the original flow and has nothing
// to settle. `approval` is the approval of the first deal above.
await mustFail(
  "settling a deal that has no escrow",
  () =>
    submitExercise(
      bob,
      {
        templateId:
          approvalTemplate,

        contractId:
          approval.contractId,

        choice:
          "Settle",

        choiceArgument: {},
      },
    ),
);

// Holdings only move with both parties' authority. The positive controls
// (both parties acting) show that the rejections are authorization
// failures and not something else.
const jointDepositId =
  `joint-${runId}`;

const jointDealId =
  `outside-a-deal-${runId}`;

const jointDeposit =
  await issueHolding(
    custodian,
    bob,
    jointDepositId,
    "50",
  );

await mustFail(
  "locking a holding without the payee's authority",
  () =>
    submitExercise(
      bob,
      {
        templateId:
          custodyTemplate(
            "CashHolding",
          ),

        contractId:
          jointDeposit
            .contractId,

        choice:
          "LockForDeal",

        choiceArgument: {
          dealId:
            jointDealId,

          payee:
            alice,
        },
      },
    ),
);

await submitExerciseAs(
  [bob, alice],
  {
    templateId:
      custodyTemplate(
        "CashHolding",
      ),

    contractId:
      jointDeposit
        .contractId,

    choice:
      "LockForDeal",

    choiceArgument: {
      dealId:
        jointDealId,

      payee:
        alice,
    },
  },
);

const jointLocked =
  await findActive(
    bob,
    ":Vinss.Custody:LockedHolding",
    (args) =>
      args.dealId ===
      jointDealId,
  );

assert.ok(
  jointLocked,
  "jointly locked holding was not created",
);

await mustFail(
  "payer releasing a jointly locked holding alone",
  () =>
    submitExercise(
      bob,
      {
        templateId:
          lockedTemplate,

        contractId:
          jointLocked
            .contractId,

        choice:
          "ReleaseToPayee",

        choiceArgument: {},
      },
    ),
);

await mustFail(
  "payee releasing a jointly locked holding alone",
  () =>
    submitExercise(
      alice,
      {
        templateId:
          lockedTemplate,

        contractId:
          jointLocked
            .contractId,

        choice:
          "ReleaseToPayee",

        choiceArgument: {},
      },
    ),
);

await submitExerciseAs(
  [bob, alice],
  {
    templateId:
      lockedTemplate,

    contractId:
      jointLocked
        .contractId,

    choice:
      "ReleaseToPayee",

    choiceArgument: {},
  },
);

const jointReleased =
  await findActive(
    alice,
    ":Vinss.Custody:CashHolding",
    holdingIs(
      `${jointDepositId}:released`,
    ),
  );

assert.ok(
  jointReleased,
  "jointly released holding was not created",
);

assert.equal(
  jointReleased
    .createArgument
    .owner,
  alice,
);

console.log(
  "REAL CANTON ESCROW BYPASS ATTEMPTS: BLOCKED",
);

console.log(
  "REAL CANTON CUSTODIAN PRIVACY: PASS",
);
