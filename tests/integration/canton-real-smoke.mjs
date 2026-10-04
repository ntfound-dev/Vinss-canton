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

          // No Token Standard registry: this deal keeps the original flow.
          instrumentAdmin:
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
// VINSS non-custodial CIP-56 escrow.
// ---------------------------------------------------------------

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
      ).endsWith(
        suffix,
      ) &&
      predicate(
        event?.createArgument ??
          {},
      ),
  );
}

const TEST_TOKEN_PACKAGE =
  "vinss-canton-test-token";

const registryTemplate =
  `#${TEST_TOKEN_PACKAGE}:Vinss.TestToken.Registry:TestRegistry`;

const allocationFactoryInterface =
  "#splice-api-token-allocation-instruction-v1:Splice.Api.Token.AllocationInstructionV1:AllocationFactory";

const registryAdmin =
  await allocateParty(
    `Registry-${crypto.randomUUID().slice(0, 8)}`,
    synchronizerId,
  );

await submitCreates(
  registryAdmin,
  [
    {
      templateId:
        registryTemplate,
      createArguments: {
        admin:
          registryAdmin,
        observers: [
          alice,
          bob,
        ],
        supportedInstruments: [
          "USD",
        ],
      },
    },
  ],
);

const registry =
  await findActive(
    bob,
    ":Vinss.TestToken.Registry:TestRegistry",
  );

assert.ok(
  registry,
  "Token Standard test registry was not created",
);

await submitExerciseAs(
  [
    registryAdmin,
    bob,
  ],
  {
    templateId:
      registryTemplate,
    contractId:
      registry.contractId,
    choice:
      "MintForTest",
    choiceArgument: {
      owner:
        bob,
      instrumentId:
        "USD",
      amount:
        "100.0",
    },
  },
);

const payerHolding =
  await findActive(
    bob,
    ":Vinss.TestToken.Holding:TestHolding",
    (args) =>
      args.owner === bob &&
      args.instrumentId?.admin ===
        registryAdmin &&
      args.instrumentId?.id ===
        "USD",
  );

assert.ok(
  payerHolding,
  "Payer test holding was not created",
);

const escrowDealId =
  crypto.randomUUID();

await submitCreates(
  alice,
  [
    {
      templateId:
        `#${PACKAGE}:Vinss.Deal:DealProposal`,
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
          crypto
            .createHash("sha256")
            .update(
              "VINSS CIP-56 escrow terms",
            )
            .digest("hex"),
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
        instrumentAdmin:
          registryAdmin,
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
  "CIP-56 DealProposal was not created",
);

await submitExercise(
  bob,
  {
    templateId:
      `#${PACKAGE}:Vinss.Deal:DealProposal`,
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
  "CIP-56 DealAgreement was not created",
);

const requestedAt =
  new Date(
    Date.now() - 1_000,
  ).toISOString();

const allocateBefore =
  new Date(
    Date.now() +
      15 * 60 * 1000,
  ).toISOString();

const settleBefore =
  new Date(
    Date.now() +
      30 * 60 * 1000,
  ).toISOString();

await submitExercise(
  bob,
  {
    templateId:
      allocationFactoryInterface,
    contractId:
      registry.contractId,
    choice:
      "AllocationFactory_Allocate",
    choiceArgument: {
      expectedAdmin:
        registryAdmin,
      allocation: {
        settlement: {
          executor:
            alice,
          settlementRef: {
            id:
              escrowDealId,
            cid:
              null,
          },
          requestedAt,
          allocateBefore,
          settleBefore,
          meta: {
            values: {},
          },
        },
        transferLegId:
          "vinss-principal",
        transferLeg: {
          sender:
            bob,
          receiver:
            alice,
          amount:
            "100.0",
          instrumentId: {
            admin:
              registryAdmin,
            id:
              "USD",
          },
          meta: {
            values: {},
          },
        },
      },
      requestedAt,
      inputHoldingCids: [
        payerHolding
          .contractId,
      ],
      extraArgs: {
        context: {
          values: {},
        },
        meta: {
          values: {},
        },
      },
    },
  },
);

const allocation =
  await findActive(
    bob,
    ":Vinss.TestToken.Allocation:TestAllocation",
    (args) =>
      args.allocation
        ?.settlement
        ?.settlementRef
        ?.id ===
      escrowDealId,
  );

assert.ok(
  allocation,
  "AllocationFactory did not create a CIP-56 Allocation",
);

await submitExercise(
  bob,
  {
    templateId:
      `#${PACKAGE}:Vinss.Deal:DealAgreement`,
    contractId:
      escrowAgreement.contractId,
    choice:
      "FundEscrow",
    choiceArgument: {
      allocationCid:
        allocation.contractId,
    },
  },
);

const fundedEscrow =
  await findActive(
    alice,
    ":Vinss.Deal:DealEscrow",
    (args) =>
      args.dealId ===
        escrowDealId,
  );

assert.ok(
  fundedEscrow,
  "VINSS did not accept the Token Standard Allocation",
);

const escrowFulfillmentHash =
  crypto
    .createHash("sha256")
    .update(
      "VINSS CIP-56 fulfillment",
    )
    .digest("hex");

await submitExercise(
  alice,
  {
    templateId:
      `#${PACKAGE}:Vinss.Deal:DealEscrow`,
    contractId:
      fundedEscrow.contractId,
    choice:
      "SubmitFundedFulfillment",
    choiceArgument: {
      fulfillmentHash:
        escrowFulfillmentHash,
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
  "CIP-56 funded fulfillment was not created",
);

await submitExercise(
  bob,
  {
    templateId:
      `#${PACKAGE}:Vinss.Deal:DealFulfillment`,
    contractId:
      escrowFulfillment.contractId,
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
  "CIP-56 FulfillmentApproval was not created",
);

await submitExercise(
  alice,
  {
    templateId:
      `#${PACKAGE}:Vinss.Deal:FulfillmentApproval`,
    contractId:
      escrowApproval.contractId,
    choice:
      "Settle",
    choiceArgument: {
      extraArgs: {
        context: {
          values: {},
        },
        meta: {
          values: {},
        },
      },
    },
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

const receiverHolding =
  await findActive(
    alice,
    ":Vinss.TestToken.Holding:TestHolding",
    (args) =>
      args.owner ===
        alice &&
      args.instrumentId?.admin ===
        registryAdmin &&
      args.instrumentId?.id ===
        "USD",
  );

assert.ok(
  receiverHolding,
  "Allocation_ExecuteTransfer did not create the payee holding",
);

console.log(
  "REAL CANTON ALLOCATION FACTORY: PASS",
);

console.log(
  "REAL CANTON NON-CUSTODIAL FUNDING: PASS",
);

console.log(
  "REAL CANTON ALLOCATION EXECUTE TRANSFER: PASS",
);

console.log(
  "REAL CANTON SETTLEMENT RECEIPT: PASS",
);
