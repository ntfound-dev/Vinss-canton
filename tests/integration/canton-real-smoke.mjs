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
