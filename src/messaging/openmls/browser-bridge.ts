import type {
  ConversationId,
  GroupMember,
  GroupMembershipChange,
  GroupSnapshot,
  MessagingIdentity,
} from "../types.js";
import type { OpenMlsBridge } from "./bridge.js";
import type {
  OpenMlsWasmLoader,
  OpenMlsWasmModule,
  WasmGroup,
  WasmIdentity,
  WasmProvider,
} from "./wasm-api.js";

type PendingMembershipChange =
  | {
      type: "add";
      member: GroupMember;
    }
  | {
      type: "remove";
      installationId: string;
    };

interface GroupState {
  group: WasmGroup;
  snapshot: GroupSnapshot;
  pendingChange?: PendingMembershipChange;
}

export class BrowserOpenMlsBridge
  implements OpenMlsBridge
{
  #module: OpenMlsWasmModule | undefined;
  #provider: WasmProvider | undefined;
  #identity: WasmIdentity | undefined;
  #activeIdentity: MessagingIdentity | undefined;

  readonly #groups =
    new Map<ConversationId, GroupState>();

  constructor(
    private readonly loadWasm: OpenMlsWasmLoader,
  ) {}

  async initialize(
    identity: MessagingIdentity,
  ): Promise<void> {
    this.disposeSession();

    const module = await this.loadWasm();
    assertCompatibleApi(module);

    const provider = new module.Provider();

    // MLS identity identifies this VINSS installation.
    // Canton signing keys are deliberately not reused here.
    const mlsIdentity = new module.Identity(
      provider,
      identityKey(identity),
    );

    this.#module = module;
    this.#provider = provider;
    this.#identity = mlsIdentity;
    this.#activeIdentity = identity;
  }

  async createKeyPackage(): Promise<Uint8Array> {
    const {
      provider,
      identity,
    } = this.requireSession();

    const keyPackage =
      identity.create_key_package(provider);

    try {
      return copyBytes(keyPackage.to_bytes());
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
      { group, snapshot },
    );

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
        state.pendingChange = {
          type: "add",
          member: cloneMember(input.member),
        };

        return {
          commit: copyBytes(result.commit),
          welcome: copyBytes(result.welcome),
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

    state.pendingChange = {
      type: "remove",
      installationId:
        input.installationId,
    };

    return {
      commit: copyBytes(commit),
    };
  }

  async mergePendingCommit(
    conversationId: ConversationId,
  ): Promise<GroupSnapshot> {
    const { provider } =
      this.requireSession();

    const state =
      this.requireGroup(conversationId);

    const change =
      state.pendingChange;

    if (!change) {
      throw new Error(
        `MLS group has no pending commit: ${conversationId}`,
      );
    }

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

    delete state.pendingChange;

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

    delete state.pendingChange;
  }

  async joinFromWelcome(input: {
    welcome: Uint8Array;
    metadata: GroupSnapshot["metadata"];
    members: readonly GroupMember[];
  }): Promise<GroupSnapshot> {
    const {
      module,
      provider,
      activeIdentity,
    } = this.requireSession();

    if (
      !input.members.some(
        (member) =>
          member.installationId ===
          activeIdentity.installationId,
      )
    ) {
      throw new Error(
        "Active installation is not listed in the MLS group",
      );
    }

    if (
      this.#groups.has(
        input.metadata.conversationId,
      )
    ) {
      throw new Error(
        `MLS group already exists: ${input.metadata.conversationId}`,
      );
    }

    const group = module.Group.join(
      provider,
      input.welcome,
    );

    const snapshot: GroupSnapshot = {
      metadata: {
        ...input.metadata,
      },
      epoch: group.epoch(),
      members:
        input.members.map(cloneMember),
    };

    this.#groups.set(
      input.metadata.conversationId,
      { group, snapshot },
    );

    return cloneSnapshot(snapshot);
  }

  async processHandshake(input: {
    conversationId: ConversationId;
    message: Uint8Array;
    change: GroupMembershipChange;
  }): Promise<GroupSnapshot> {
    const { provider } =
      this.requireSession();

    const state =
      this.requireGroup(
        input.conversationId,
      );

    validateMembershipChange(
      state.snapshot,
      input.change,
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
        members:
          applyMembershipChange(
            state.snapshot,
            input.change,
          ),
      };

      return cloneSnapshot(
        state.snapshot,
      );
    } finally {
      result.free();
    }
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

    const ciphertext = state.group.encrypt(
      provider,
      identity,
      input.plaintext,
    );

    return {
      epoch,
      ciphertext: copyBytes(ciphertext),
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

      return {
        epoch: result.epoch,
        plaintext: copyBytes(
          result.payload,
        ),
      };
    } finally {
      result.free();
    }
  }

  async getGroupSnapshot(
    conversationId: ConversationId,
  ): Promise<GroupSnapshot> {
    return cloneSnapshot(
      this.requireGroup(
        conversationId,
      ).snapshot,
    );
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
    if (state.pendingChange) {
      throw new Error(
        "MLS group already has a pending commit",
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
  }
}

function assertCompatibleApi(
  module: OpenMlsWasmModule,
): void {
  const version =
    module.vinss_mls_api_version();

  if (
    !version.startsWith(
      "vinss-mls/0.2-openmls-0.9",
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

function validateMembershipChange(
  snapshot: GroupSnapshot,
  change: GroupMembershipChange,
): void {
  if (change.type === "add") {
    if (
      snapshot.members.some(
        (member) =>
          member.installationId ===
          change.member
            .installationId,
      )
    ) {
      throw new Error(
        `MLS member already exists: ${change.member.installationId}`,
      );
    }

    return;
  }

  if (
    !snapshot.members.some(
      (member) =>
        member.installationId ===
        change.installationId,
    )
  ) {
    throw new Error(
      `MLS member does not exist: ${change.installationId}`,
    );
  }
}

function applyMembershipChange(
  snapshot: GroupSnapshot,
  change: GroupMembershipChange,
): readonly GroupMember[] {
  if (change.type === "add") {
    return [
      ...snapshot.members,
      cloneMember(change.member),
    ];
  }

  return snapshot.members.filter(
    (member) =>
      member.installationId !==
      change.installationId,
  );
}
