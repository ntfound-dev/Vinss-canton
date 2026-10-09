import type * as Sdk from "@canton-network/dapp-sdk";

export type DevNetAccount = { userId: string; partyId: string; parties: string[]; ccAdmin?: string; authenticated?: boolean; configured?: boolean };
export type DevNetApproval = { params: Sdk.PrepareExecuteParams; partyId: string };
let account: DevNetAccount | undefined;
let checkedAt = 0;
let revision = 0;
let restoring: Promise<DevNetAccount | undefined> | undefined;
let approvalHandler: ((input: DevNetApproval) => Promise<boolean>) | undefined;
const accountListeners = new Set<(accounts: Sdk.Wallet[]) => void>();
const statusListeners = new Set<(status: Sdk.StatusEvent) => void>();

export async function devNetRequest<T>(body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const response = await fetch("/api/devnet", { method, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(35000),
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
  const value = await response.json();
  if (!response.ok) {
    if (response.status === 401) { account = undefined; checkedAt = 0; publish(); }
    throw new Error(value.error || `DevNet request failed: HTTP ${response.status}`);
  }
  return value;
}
function accounts(): Sdk.Wallet[] {
  return account?.partyId ? [{ partyId: account.partyId, primary: true, status: "allocated", networkId: "devnet", hint: "HackCanton DevNet" }] as Sdk.Wallet[] : [];
}
function status(): Sdk.StatusEvent {
  return { provider: { id: "vinss-noders-devnet" }, network: { networkId: "devnet" }, connection: { isConnected: !!account?.partyId, isNetworkConnected: !!account?.partyId } };
}
function publish() { for (const fn of accountListeners) fn(accounts()); for (const fn of statusListeners) fn(status()); }
async function restore(): Promise<DevNetAccount | undefined> {
  if (account && Date.now() - checkedAt < 2000) return account;
  if (restoring) return restoring;
  const snapshot = revision;
  restoring = (async () => {
    const value = await devNetRequest<DevNetAccount>();
    if (snapshot !== revision) return account;
    account = value.authenticated ? value : undefined;
    checkedAt = Date.now();
    return account;
  })().finally(() => { restoring = undefined; });
  return restoring;
}
export async function loginDevNet(input: { username?: string; password?: string; accessToken?: string; totp?: string }): Promise<DevNetAccount> {
  const value = await devNetRequest<DevNetAccount>({ operation: "login", ...input });
  if (!value.authenticated || !value.partyId) throw new Error("DevNet login did not return an authorized Party.");
  revision++; account = value;
  checkedAt = Date.now();
  return value;
}
export async function selectDevNetParty(partyId: string): Promise<void> {
  const value = await devNetRequest<DevNetAccount>({ operation: "select", partyId });
  revision++; account = { ...account, ...value }; checkedAt = Date.now(); publish();
}
export function installDevNetApproval(handler: (input: DevNetApproval) => Promise<boolean>): () => void {
  approvalHandler = handler;
  return () => { if (approvalHandler === handler) approvalHandler = undefined; };
}
export const devNetWallet = {
  async connect() {
    if (!await restore()) throw new Error("Sign in to your HackCanton DevNet account first.");
    return status().connection;
  },
  async isConnected() { await restore(); return status().connection; },
  async status() { await restore(); return status(); },
  async listAccounts() { await restore(); return accounts(); },
  async disconnect() { await devNetRequest(undefined, "DELETE"); revision++; account = undefined; checkedAt = 0; publish(); },
  async onAccountsChanged(fn: (accounts: Sdk.Wallet[]) => void) { accountListeners.add(fn); },
  async removeOnAccountsChanged(fn: (accounts: Sdk.Wallet[]) => void) { accountListeners.delete(fn); },
  async onStatusChanged(fn: (status: Sdk.StatusEvent) => void) { statusListeners.add(fn); },
  async removeOnStatusChanged(fn: (status: Sdk.StatusEvent) => void) { statusListeners.delete(fn); },
  ledgerApi(params: Sdk.LedgerApiParams): Promise<unknown> { return devNetRequest({ operation: "read", ...params }); },
  async prepareExecuteAndWait(input: Sdk.PrepareExecuteParams): Promise<Sdk.PrepareExecuteAndWaitResult> {
    const current = await restore();
    if (!current || !approvalHandler) throw new Error("Open VINSS and sign in before approving a DevNet transaction.");
    // Copy the envelope before showing approval; submit exactly what was reviewed.
    const params = JSON.parse(JSON.stringify({ ...input, commandId: input.commandId || crypto.randomUUID() })) as Sdk.PrepareExecuteParams;
    const prepared = await devNetRequest<{ ticket: string }>({ operation: "prepare", params });
    if (!await approvalHandler({ params, partyId: current.partyId })) throw new Error("DevNet transaction rejected. No submission was sent.");
    const receipt = await devNetRequest<{ updateId: string; completionOffset: string | number }>({ operation: "execute", params, ticket: prepared.ticket });
    if (!receipt.updateId || receipt.completionOffset === undefined) throw new Error("The ledger returned no complete receipt. Check DevNet transaction history before retrying.");
    return { tx: { commandId: params.commandId!, status: "executed", payload: receipt } } as Sdk.PrepareExecuteAndWaitResult;
  },
  ccAdmin: () => account?.ccAdmin,
  availableParties: () => account?.parties || [],
};

// Forward the user's token only to the fixed NODERS CC registry on the server.
export const devNetRegistryFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
  const base = "https://validator-api-http.validator.hackcanton-01.devnet.naas.noders.services/api/validator/v0/scan-proxy";
  if (!url.toString().startsWith(base + "/registry/")) return fetch(input, init);
  if ((init?.method || "GET").toUpperCase() !== "POST" || typeof init?.body !== "string") throw new Error("Invalid DevNet registry request.");
  const value = await devNetRequest({ operation: "registry", path: url.pathname.slice(new URL(base).pathname.length), body: JSON.parse(init.body) });
  return Response.json(value);
};
