export interface WasmProvider {
  free(): void;
}

export interface WasmIdentity {
  create_key_package(provider: WasmProvider): WasmKeyPackage;
  free(): void;
}

export interface WasmKeyPackage {
  to_bytes(): Uint8Array;
  free(): void;
}

export interface WasmAddMemberResult {
  readonly commit: Uint8Array;
  readonly welcome: Uint8Array;
  free(): void;
}

export interface WasmProcessResult {
  readonly epoch: bigint;
  readonly kind: string;
  readonly payload: Uint8Array;
  free(): void;
}

export interface WasmGroup {
  add_member(
    provider: WasmProvider,
    sender: WasmIdentity,
    newMember: WasmKeyPackage,
  ): WasmAddMemberResult;

  remove_member(
    provider: WasmProvider,
    sender: WasmIdentity,
    leafIndex: number,
  ): Uint8Array;

  merge_pending_commit(provider: WasmProvider): void;

  clear_pending_commit(provider: WasmProvider): void;

  encrypt(
    provider: WasmProvider,
    sender: WasmIdentity,
    plaintext: Uint8Array,
  ): Uint8Array;

  process(
    provider: WasmProvider,
    message: Uint8Array,
  ): WasmProcessResult;

  epoch(): bigint;

  member_count(): number;

  member_index(identity: string): number | undefined;

  free(): void;
}

export interface OpenMlsWasmModule {
  readonly Provider: new () => WasmProvider;

  readonly Identity: new (
    provider: WasmProvider,
    identity: string,
  ) => WasmIdentity;

  readonly KeyPackage: {
    from_bytes(bytes: Uint8Array): WasmKeyPackage;
  };

  readonly Group: {
    create(
      provider: WasmProvider,
      founder: WasmIdentity,
      groupId: string,
    ): WasmGroup;

    join(
      provider: WasmProvider,
      welcome: Uint8Array,
    ): WasmGroup;
  };

  vinss_mls_api_version(): string;
}

export interface GeneratedOpenMlsWasmModule
  extends OpenMlsWasmModule {
  default(input?: unknown): Promise<unknown>;
}

export type OpenMlsWasmLoader =
  () => Promise<OpenMlsWasmModule>;
