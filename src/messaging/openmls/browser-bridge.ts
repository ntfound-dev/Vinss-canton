import type {
  ConversationId,
  GroupMember,
  GroupSnapshot,
  MessagingIdentity,
} from "../types.js";
import type {
  OpenMlsBridge,
  OpenMlsPendingCommitRecovery,
} from "./bridge.js";
import type {
  OpenMlsCheckpointStore,
  OpenMlsPendingOutboundCommit,
} from "./checkpoint.js";

import type {
  OpenMlsWasmLoader,
  OpenMlsWasmModule,
  WasmGroup,
  WasmIdentity,
  WasmProvider,
} from "./wasm-api.js";

interface GroupState {
  group: WasmGroup;
  snapshot: GroupSnapshot;
  hydrated: boolean;

  pendingOutbound?:
    OpenMlsPendingOutboundCommit;

  needsGroupStatePublish:
    boolean;
}

const MAX_PROCESSED_HANDSHAKES =
  256;

export class BrowserOpenMlsBridge
  implements OpenMlsBridge
{
  #module: OpenMlsWasmModule | undefined;
  #provider: WasmProvider | undefined;
  #identity: WasmIdentity | undefined;
  #activeIdentity: MessagingIdentity | undefined;

  readonly #groups =
    new Map<ConversationId, GroupState>();

  #handshakeCursor:
    | string
    | undefined;

  readonly #processedHandshakeIds =
    new Set<string>();

  constructor(
    private readonly loadWasm:
      OpenMlsWasmLoader,

    private readonly checkpointStore?:
      OpenMlsCheckpointStore,
  ) {}

  async initialize(
    identity: MessagingIdentity,
  ): Promise<void> {
    this.disposeSession();

    const module =
      await this.loadWasm();

    assertCompatibleApi(
      module,
    );

    const provider =
      new module.Provider();

    const persisted =
      await this.checkpointStore
        ?.load(
          identity.installationId,
        );

    this.#module = module;
    this.#provider = provider;
    this.#activeIdentity =
      identity;

    try {
      if (persisted) {
        if (
          persisted.identityKey !==
          identityKey(identity)
        ) {
          throw new Error(
            "Persisted MLS identity does not match active installation",
          );
        }

        provider.import_storage(
          persisted.providerStorage,
        );

        this.#identity =
          module.Identity.load(
            provider,
            identityKey(identity),
            persisted
              .identityPublicKey,
          );

        this.#handshakeCursor =
          persisted.handshakeCursor;

        for (
          const handshakeId
          of persisted
            .processedHandshakeIds
        ) {
          this.#processedHandshakeIds
            .add(handshakeId);
        }

        for (
          const persistedGroup
          of persisted.groups
        ) {
          const conversationId =
            persistedGroup
              .snapshot
              .metadata
              .conversationId;

          const group =
            module.Group.load(
              provider,
              conversationId,
            );

          if (
            group.epoch() !==
            persistedGroup
              .snapshot
              .epoch
          ) {
            group.free();

            throw new Error(
              `Persisted MLS epoch mismatch: ${conversationId}`,
            );
          }

          this.#groups.set(
            conversationId,
            {
              group,

              snapshot:
                cloneSnapshot(
                  persistedGroup
                    .snapshot,
                ),

              hydrated:
                persistedGroup
                  .hydrated,

              ...(persistedGroup
                .pendingOutbound
                ? {
                    pendingOutbound:
                      clonePendingOutbound(
                        persistedGroup
                          .pendingOutbound,
                      ),
                  }
                : {}),

              needsGroupStatePublish:
                persistedGroup
                  .needsGroupStatePublish ??
                false,
            },
          );
        }

        return;
      }

      this.#identity =
        new module.Identity(
          provider,
          identityKey(identity),
        );

      await this.persistCheckpoint();
    } catch (error) {
      this.disposeSession();
      throw error;
    } finally {
      persisted
        ?.providerStorage
        .fill(0);
    }
  }

  async createKeyPackage(): Promise<Uint8Array> {
    const {
      provider,
      identity,
    } = this.requireSession();

    const keyPackage =
      identity.create_key_package(provider);

    try {
      const bytes =
        copyBytes(
          keyPackage.to_bytes(),
        );

      await this.persistCheckpoint();

      return bytes;
    } finally {
      keyPackage.free();
    }
  }

  async createGroup(input: {
    conversationId: ConversationId;
    title: string;
    creator: GroupMember;
  }): Promise<GroupSnapshot> {
    const {
      module,
      provider,
      identity,
      activeIdentity,
    } = this.requireSession();

    if (
      input.creator.userId !== activeIdentity.userId ||
      input.creator.installationId !==
        activeIdentity.installationId
    ) {
      throw new Error(
        "MLS group creator must match the active installation",
      );
    }

    if (this.#groups.has(input.conversationId)) {
      throw new Error(
        `MLS group already exists: ${input.conversationId}`,
      );
    }

    const group = module.Group.create(
      provider,
      identity,
      input.conversationId,
    );

    const snapshot: GroupSnapshot = {
      metadata: {
        conversationId: input.conversationId,
        title: input.title,
        createdAt: Date.now(),
        createdBy: input.creator.userId,
      },
      epoch: group.epoch(),
      members: [cloneMember(input.creator)],
    };

    this.#groups.set(
      input.conversationId,
      {
        group,
        snapshot,
        hydrated: true,
        needsGroupStatePublish:
          false,
      },
    );

    await this.persistCheckpoint();

    return cloneSnapshot(snapshot);
  }

  async prepareAddMember(input: {
    conversationId: ConversationId;
    member: GroupMember;
    keyPackage: Uint8Array;
  }): Promise<{
    commit: Uint8Array;
    welcome: Uint8Array;
  }> {
    const {
      module,
      provider,
      identity,
    } = this.requireSession();

    const state =
      this.requireGroup(input.conversationId);

    this.requireNoPendingCommit(state);

    if (
      state.snapshot.members.some(
        (member) =>
          member.installationId ===
          input.member.installationId,
      )
    ) {
      throw new Error(
        `Installation already belongs to MLS group: ${input.member.installationId}`,
      );
    }

    const keyPackage =
      module.KeyPackage.from_bytes(
        input.keyPackage,
      );

    try {
      const result = state.group.add_member(
        provider,
        identity,
        keyPackage,
      );

      try {
        const commit =
          copyBytes(
            result.commit,
          );

        const welcome =
          copyBytes(
            result.welcome,
          );

        state.pendingOutbound = {
          change: {
            type: "add",
            member:
              cloneMember(
                input.member,
              ),
          },

          commit:
            copyBytes(commit),

          welcome:
            copyBytes(welcome),

          sentAt:
            Date.now(),

          targetEpoch:
            state.snapshot.epoch +
            1n,
        };

        await this.persistCheckpoint();

        return {
          commit,
          welcome,
        };
      } finally {
        result.free();
      }
    } finally {
      keyPackage.free();
    }
  }

  async prepareRemoveMember(input: {
    conversationId: ConversationId;
    installationId: string;
  }): Promise<{
    commit: Uint8Array;
  }> {
    const {
      provider,
      identity,
    } = this.requireSession();

    const state =
      this.requireGroup(input.conversationId);

    this.requireNoPendingCommit(state);

    const member =
      state.snapshot.members.find(
        (candidate) =>
          candidate.installationId ===
          input.installationId,
      );

    if (!member) {
      throw new Error(
        `MLS member not found: ${input.installationId}`,
      );
    }

    const leafIndex =
      state.group.member_index(
        identityKey(member),
      );

    if (leafIndex === undefined) {
      throw new Error(
        `MLS leaf not found for installation: ${input.installationId}`,
      );
    }

    const commit =
      state.group.remove_member(
        provider,
        identity,
        leafIndex,
      );

    const commitBytes =
      copyBytes(commit);

    state.pendingOutbound = {
      change: {
        type: "remove",
        installationId:
          input.installationId,
      },

      commit:
        copyBytes(
          commitBytes,
        ),

      sentAt:
        Date.now(),

      targetEpoch:
        state.snapshot.epoch +
        1n,
    };

    await this.persistCheckpoint();

    return {
      commit:
        commitBytes,
    };
  }

  async mergePendingCommit(
    conversationId: ConversationId,
  ): Promise<GroupSnapshot> {
    const { provider } =
      this.requireSession();

    const state =
      this.requireGroup(conversationId);

    const pending =
      state.pendingOutbound;

    if (!pending) {
      throw new Error(
        `MLS group has no pending commit: ${conversationId}`,
      );
    }

    const change =
      pending.change;

    state.group.merge_pending_commit(
      provider,
    );

    if (change.type === "add") {
      state.snapshot = {
        ...state.snapshot,
        epoch: state.group.epoch(),
        members: [
          ...state.snapshot.members,
          cloneMember(change.member),
        ],
      };
    } else {
      state.snapshot = {
        ...state.snapshot,
        epoch: state.group.epoch(),
        members:
          state.snapshot.members.filter(
            (member) =>
              member.installationId !==
              change.installationId,
          ),
      };
    }

    delete state.pendingOutbound;

    state.needsGroupStatePublish =
      true;

    await this.persistCheckpoint();

    return cloneSnapshot(
      state.snapshot,
    );
  }

  async clearPendingCommit(
    conversationId: ConversationId,
  ): Promise<void> {
    const { provider } =
      this.requireSession();

    const state =
      this.requireGroup(conversationId);

    state.group.clear_pending_commit(
      provider,
    );

    delete state.pendingOutbound;

    await this.persistCheckpoint();
  }

  async joinFromWelcome(input: {
    welcome: Uint8Array;
    conversationId: ConversationId;
    handshakeId?: string;
  }): Promise<GroupSnapshot> {
    const {
      module,
      provider,
    } = this.requireSession();

    if (
      this.#groups.has(
        input.conversationId,
      )
    ) {
      throw new Error(
        `MLS group already exists: ${input.conversationId}`,
      );
    }

    const group =
      module.Group.join(
        provider,
        input.welcome,
      );

    // Only cryptographic MLS state comes from Welcome.
    // Application metadata is received later inside an
    // MLS-encrypted group_state application payload.
    const snapshot: GroupSnapshot = {
      metadata: {
        conversationId:
          input.conversationId,
        title: "",
        createdAt: 0,
        createdBy: "",
      },
      epoch:
        group.epoch(),
      members: [],
    };

    this.#groups.set(
      input.conversationId,
      {
        group,
        snapshot,
        hydrated: false,
        needsGroupStatePublish:
          false,
      },
    );

    if (input.handshakeId) {
      this.markHandshakeProcessed(
        input.handshakeId,
      );
    }

    await this.persistCheckpoint();

    return cloneSnapshot(
      snapshot,
    );
  }

  async processHandshake(input: {
    conversationId: ConversationId;
    message: Uint8Array;
    handshakeId?: string;
  }): Promise<GroupSnapshot> {
    const { provider } =
      this.requireSession();

    const state =
      this.requireGroup(
        input.conversationId,
      );

    const result =
      state.group.process(
        provider,
        input.message,
      );

    try {
      if (
        result.kind !== "commit"
      ) {
        throw new Error(
          `Expected MLS Commit, got ${result.kind}`,
        );
      }

      state.snapshot = {
        ...state.snapshot,
        epoch:
          state.group.epoch(),
      };

      if (input.handshakeId) {
        this.markHandshakeProcessed(
          input.handshakeId,
        );
      }

      await this.persistCheckpoint();

      return cloneSnapshot(
        state.snapshot,
      );
    } finally {
      result.free();
    }
  }

  async applyGroupSnapshot(
    snapshot: GroupSnapshot,
  ): Promise<GroupSnapshot> {
    const conversationId =
      snapshot.metadata
        .conversationId;

    const state =
      this.requireGroup(
        conversationId,
      );

    if (
      snapshot.epoch !==
      state.group.epoch()
    ) {
      throw new Error(
        "Encrypted group state epoch mismatch",
      );
    }

    state.snapshot =
      cloneSnapshot(snapshot);

    state.hydrated = true;

    await this.persistCheckpoint();

    return cloneSnapshot(
      state.snapshot,
    );
  }

  async encryptApplicationMessage(input: {
    conversationId: ConversationId;
    plaintext: Uint8Array;
  }): Promise<{
    epoch: bigint;
    ciphertext: Uint8Array;
  }> {
    const {
      provider,
      identity,
    } = this.requireSession();

    const state =
      this.requireGroup(input.conversationId);

    const epoch = state.group.epoch();

    const ciphertext =
      state.group.encrypt(
        provider,
        identity,
        input.plaintext,
      );

    await this.persistCheckpoint();

    return {
      epoch,
      ciphertext:
        copyBytes(ciphertext),
    };
  }

  async decryptApplicationMessage(input: {
    conversationId: ConversationId;
    ciphertext: Uint8Array;
  }): Promise<{
    epoch: bigint;
    plaintext: Uint8Array;
  }> {
    const { provider } =
      this.requireSession();

    const state =
      this.requireGroup(input.conversationId);

    const result = state.group.process(
      provider,
      input.ciphertext,
    );

    try {
      if (result.kind !== "application") {
        throw new Error(
          `Expected MLS application message, got ${result.kind}`,
        );
      }

      const plaintext =
        copyBytes(
          result.payload,
        );

      await this.persistCheckpoint();

      return {
        epoch:
          result.epoch,
        plaintext,
      };
    } finally {
      result.free();
    }
  }

  async listPendingOutboundCommits():
    Promise<
      readonly OpenMlsPendingCommitRecovery[]
    > {
    this.requireSession();

    const result:
      OpenMlsPendingCommitRecovery[] =
      [];

    for (
      const [
        conversationId,
        state,
      ]
      of this.#groups
    ) {
      if (!state.pendingOutbound) {
        continue;
      }

      result.push({
        conversationId,

        snapshot:
          cloneSnapshot(
            state.snapshot,
          ),

        ...clonePendingOutbound(
          state.pendingOutbound,
        ),
      });
    }

    return result;
  }

  async listGroupsNeedingStatePublish():
    Promise<
      readonly GroupSnapshot[]
    > {
    this.requireSession();

    return [
      ...this.#groups
        .values(),
    ]
      .filter(
        (state) =>
          state.needsGroupStatePublish,
      )
      .map(
        (state) =>
          cloneSnapshot(
            state.snapshot,
          ),
      );
  }

  async markGroupStatePublished(
    conversationId:
      ConversationId,
  ): Promise<void> {
    const state =
      this.requireGroup(
        conversationId,
      );

    state.needsGroupStatePublish =
      false;

    await this.persistCheckpoint();
  }

  async getHandshakeCursor():
    Promise<string | undefined> {
    this.requireSession();

    return this.#handshakeCursor;
  }

  async saveHandshakeCursor(
    cursor: string,
  ): Promise<void> {
    this.requireSession();

    if (cursor.length === 0) {
      throw new Error(
        "MLS handshake cursor cannot be empty",
      );
    }

    this.#handshakeCursor =
      cursor;

    await this.persistCheckpoint();
  }

  async hasProcessedHandshake(
    handshakeId: string,
  ): Promise<boolean> {
    this.requireSession();

    return this
      .#processedHandshakeIds
      .has(handshakeId);
  }

  async getGroupSnapshot(
    conversationId: ConversationId,
  ): Promise<GroupSnapshot> {
    const state =
      this.requireGroup(
        conversationId,
      );

    if (!state.hydrated) {
      throw new Error(
        "MLS group metadata has not been hydrated",
      );
    }

    return cloneSnapshot(
      state.snapshot,
    );
  }

  private async persistCheckpoint():
    Promise<void> {
    if (!this.checkpointStore) {
      return;
    }

    const {
      provider,
      identity,
      activeIdentity,
    } = this.requireSession();

    const providerStorage =
      copyBytes(
        provider.export_storage(),
      );

    try {
      await this.checkpointStore
        .save(
          activeIdentity
            .installationId,

          {
            version: 1,

            identityKey:
              identityKey(
                activeIdentity,
              ),

            identityPublicKey:
              copyBytes(
                identity
                  .public_key(),
              ),

            providerStorage,

            groups: [
              ...this.#groups
                .values(),
            ].map(
              (state) => ({
                snapshot:
                  cloneSnapshot(
                    state.snapshot,
                  ),

                hydrated:
                  state.hydrated,

                ...(state
                  .pendingOutbound
                  ? {
                      pendingOutbound:
                        clonePendingOutbound(
                          state
                            .pendingOutbound,
                        ),
                    }
                  : {}),

                needsGroupStatePublish:
                  state
                    .needsGroupStatePublish,
              }),
            ),

            ...(this.#handshakeCursor
              ? {
                  handshakeCursor:
                    this.#handshakeCursor,
                }
              : {}),

            processedHandshakeIds: [
              ...this
                .#processedHandshakeIds,
            ],
          },
        );
    } finally {
      providerStorage.fill(0);
    }
  }

  private markHandshakeProcessed(
    handshakeId: string,
  ): void {
    if (
      handshakeId.length === 0
    ) {
      throw new Error(
        "MLS handshake ID cannot be empty",
      );
    }

    // Reinsert to keep Set insertion order useful
    // for bounded replay history.
    this.#processedHandshakeIds
      .delete(handshakeId);

    this.#processedHandshakeIds
      .add(handshakeId);

    while (
      this.#processedHandshakeIds
        .size >
      MAX_PROCESSED_HANDSHAKES
    ) {
      const oldest =
        this.#processedHandshakeIds
          .values()
          .next()
          .value;

      if (
        typeof oldest !==
        "string"
      ) {
        break;
      }

      this.#processedHandshakeIds
        .delete(oldest);
    }
  }

  private requireSession(): {
    module: OpenMlsWasmModule;
    provider: WasmProvider;
    identity: WasmIdentity;
    activeIdentity: MessagingIdentity;
  } {
    if (
      !this.#module ||
      !this.#provider ||
      !this.#identity ||
      !this.#activeIdentity
    ) {
      throw new Error(
        "OpenMLS browser bridge is not initialized",
      );
    }

    return {
      module: this.#module,
      provider: this.#provider,
      identity: this.#identity,
      activeIdentity: this.#activeIdentity,
    };
  }

  private requireNoPendingCommit(
    state: GroupState,
  ): void {
    if (state.pendingOutbound) {
      throw new Error(
        "MLS group already has a pending commit",
      );
    }

    if (
      state.needsGroupStatePublish
    ) {
      throw new Error(
        "MLS group has unpublished post-commit state",
      );
    }
  }

  private requireGroup(
    conversationId: ConversationId,
  ): GroupState {
    const state =
      this.#groups.get(conversationId);

    if (!state) {
      throw new Error(
        `MLS group not found: ${conversationId}`,
      );
    }

    return state;
  }

  private disposeSession(): void {
    for (
      const state
      of this.#groups.values()
    ) {
      state.group.free();
    }

    this.#groups.clear();

    this.#identity?.free();
    this.#provider?.free();

    this.#identity = undefined;
    this.#provider = undefined;
    this.#activeIdentity = undefined;
    this.#module = undefined;

    this.#handshakeCursor =
      undefined;

    this.#processedHandshakeIds
      .clear();
  }
}

function assertCompatibleApi(
  module: OpenMlsWasmModule,
): void {
  const version =
    module.vinss_mls_api_version();

  if (
    !version.startsWith(
      "vinss-mls/0.3-openmls-0.9",
    )
  ) {
    throw new Error(
      `Unsupported VINSS MLS WASM API: ${version}`,
    );
  }
}

function identityKey(
  identity:
    | MessagingIdentity
    | GroupMember,
): string {
  return `${identity.userId}:${identity.installationId}`;
}

function copyBytes(
  bytes: Uint8Array,
): Uint8Array {
  return new Uint8Array(bytes);
}

function cloneMember(
  member: GroupMember,
): GroupMember {
  return {
    ...member,
    credential:
      copyBytes(member.credential),
  };
}

function clonePendingOutbound(
  pending:
    OpenMlsPendingOutboundCommit,
): OpenMlsPendingOutboundCommit {
  return {
    change:
      pending.change.type ===
        "add"
        ? {
            type: "add",
            member:
              cloneMember(
                pending.change
                  .member,
              ),
          }
        : {
            type: "remove",
            installationId:
              pending.change
                .installationId,
          },

    commit:
      copyBytes(
        pending.commit,
      ),

    ...(pending.welcome
      ? {
          welcome:
            copyBytes(
              pending.welcome,
            ),
        }
      : {}),

    sentAt:
      pending.sentAt,

    targetEpoch:
      pending.targetEpoch,
  };
}

function cloneSnapshot(
  snapshot: GroupSnapshot,
): GroupSnapshot {
  return {
    metadata: {
      ...snapshot.metadata,
    },
    epoch: snapshot.epoch,
    members:
      snapshot.members.map(
        cloneMember,
      ),
  };
}
