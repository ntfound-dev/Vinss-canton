/* tslint:disable */
/* eslint-disable */

export class AddMemberResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly commit: Uint8Array;
    readonly welcome: Uint8Array;
}

export class Group {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    add_member(provider: Provider, sender: Identity, new_member: KeyPackage): AddMemberResult;
    clear_pending_commit(provider: Provider): void;
    static create(provider: Provider, founder: Identity, group_id: string): Group;
    encrypt(provider: Provider, sender: Identity, plaintext: Uint8Array): Uint8Array;
    epoch(): bigint;
    static join(provider: Provider, welcome_bytes: Uint8Array): Group;
    static load(provider: Provider, group_id: string): Group;
    member_count(): number;
    member_index(identity: string): number | undefined;
    merge_pending_commit(provider: Provider): void;
    process(provider: Provider, message_bytes: Uint8Array): ProcessResult;
    remove_member(provider: Provider, sender: Identity, leaf_index: number): Uint8Array;
}

export class Identity {
    free(): void;
    [Symbol.dispose](): void;
    create_key_package(provider: Provider): KeyPackage;
    static load(provider: Provider, identity: string, public_key: Uint8Array): Identity;
    constructor(provider: Provider, identity: string);
    public_key(): Uint8Array;
}

export class KeyPackage {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static from_bytes(bytes: Uint8Array): KeyPackage;
    to_bytes(): Uint8Array;
}

export class ProcessResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly epoch: bigint;
    readonly kind: string;
    readonly payload: Uint8Array;
}

export class Provider {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Export the complete OpenMLS storage working set.
     *
     * This contains private cryptographic material.
     * The browser must encrypt these bytes before durable persistence.
     */
    export_storage(): Uint8Array;
    /**
     * Replace the complete OpenMLS storage working set.
     */
    import_storage(bytes: Uint8Array): void;
    constructor();
}

export function vinss_mls_api_version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_addmemberresult_free: (a: number, b: number) => void;
    readonly __wbg_group_free: (a: number, b: number) => void;
    readonly __wbg_identity_free: (a: number, b: number) => void;
    readonly __wbg_keypackage_free: (a: number, b: number) => void;
    readonly __wbg_processresult_free: (a: number, b: number) => void;
    readonly __wbg_provider_free: (a: number, b: number) => void;
    readonly addmemberresult_commit: (a: number) => [number, number];
    readonly addmemberresult_welcome: (a: number) => [number, number];
    readonly group_add_member: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly group_clear_pending_commit: (a: number, b: number) => [number, number];
    readonly group_create: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly group_encrypt: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly group_epoch: (a: number) => bigint;
    readonly group_join: (a: number, b: number, c: number) => [number, number, number];
    readonly group_load: (a: number, b: number, c: number) => [number, number, number];
    readonly group_member_count: (a: number) => number;
    readonly group_member_index: (a: number, b: number, c: number) => number;
    readonly group_merge_pending_commit: (a: number, b: number) => [number, number];
    readonly group_process: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly group_remove_member: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly identity_create_key_package: (a: number, b: number) => [number, number, number];
    readonly identity_load: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly identity_new: (a: number, b: number, c: number) => [number, number, number];
    readonly identity_public_key: (a: number) => [number, number];
    readonly keypackage_from_bytes: (a: number, b: number) => [number, number, number];
    readonly keypackage_to_bytes: (a: number) => [number, number, number, number];
    readonly processresult_epoch: (a: number) => bigint;
    readonly processresult_kind: (a: number) => [number, number];
    readonly processresult_payload: (a: number) => [number, number];
    readonly provider_export_storage: (a: number) => [number, number, number, number];
    readonly provider_import_storage: (a: number, b: number, c: number) => [number, number];
    readonly provider_new: () => number;
    readonly vinss_mls_api_version: () => [number, number];
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
