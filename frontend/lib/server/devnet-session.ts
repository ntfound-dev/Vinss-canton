import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const DEVNET_LEDGER = "https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services";
export const DEVNET_VALIDATOR = "https://validator-api-http.validator.hackcanton-01.devnet.naas.noders.services";
const TOKEN_URL = "https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token";
const COOKIE = "vinss_devnet_session";
type ObjectValue = Record<string, unknown>;
type Session = { accessToken: string; expiresAt: number; partyId?: string };
export type DevNetAccount = { userId: string; partyId: string; parties: string[]; ccAdmin?: string };
class DevNetError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
function object(value: unknown): value is ObjectValue {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function key(): Buffer {
  const value = process.env.VINSS_DEVNET_SESSION_SECRET || "";
  if (!/^[a-fA-F0-9]{64}$/.test(value))
    throw new DevNetError("DevNet login needs VINSS_DEVNET_SESSION_SECRET configured on the server. See Connection help.", 503);
  return Buffer.from(value, "hex");
}
export function seal(value: unknown, purpose: string): string {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(purpose));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
export function unseal(value: string, purpose: string): unknown {
  try {
    const bytes = Buffer.from(value, "base64url");
    const cipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
    cipher.setAAD(Buffer.from(purpose)); cipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8"));
  } catch (e) {
    if (e instanceof DevNetError) throw e;
    throw new DevNetError("DevNet session expired or invalid. Sign in again.", 401);
  }
}
function sessionCookie(request: Request, session?: Session): string {
  const value = session ? seal(session, "session") : "";
  if (value.length > 3800) throw new DevNetError("This token is too large for a browser session. Ask the node operator for a scoped token.");
  const age = session ? Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)) : 0;
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(requestOrigin(request)).protocol === "https:" ? "; Secure" : ""}`;
}
function readSession(request: Request): Session {
  const value = (request.headers.get("cookie") || "").split(";").map(s => s.trim()).find(s => s.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  if (!value) throw new DevNetError("Sign in to your HackCanton DevNet account.", 401);
  const session = unseal(value, "session");
  if (!object(session) || typeof session.accessToken !== "string" || typeof session.expiresAt !== "number" || session.expiresAt <= Date.now())
    throw new DevNetError("DevNet session expired. Sign in again.", 401);
  return session as Session;
}
async function upstream(url: string, token: string, method = "GET", body?: unknown): Promise<unknown> {
  const response = await fetch(url, { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(25000),
    headers: { accept: "application/json", authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) {
    if (response.status === 401) throw new DevNetError("DevNet authorization expired. Sign in again.", 401);
    if (response.status === 403) throw new DevNetError("Your DevNet account lacks permission for this action. Check Party rights in the NODERS console.", 403);
    // Return ledger error codes, never raw upstream text containing credentials.
    let code = "";
    try { const value = await response.json(); if (object(value) && /^[A-Z][A-Z0-9_]{2,80}$/.test(text(value.code))) code = ` (${value.code})`; } catch {}
    throw new DevNetError(`DevNet request failed: HTTP ${response.status}${code}. Check the ledger before retrying a transaction.`, response.status >= 500 ? 502 : 400);
  }
  return response.json();
}
function partiesFromRights(value: unknown): string[] {
  if (!object(value) || !Array.isArray(value.rights)) return [];
  return [...new Set(value.rights.flatMap(right => {
    if (!object(right) || !object(right.kind) || !object(right.kind.CanActAs)) return [];
    const actor = right.kind.CanActAs;
    const party = object(actor.value) ? text(actor.value.party) : text(actor.party);
    return party ? [party] : [];
  }))];
}
export async function accountFor(session: Session): Promise<DevNetAccount> {
  const data = await upstream(DEVNET_LEDGER + "/v2/authenticated-user", session.accessToken);
  if (!object(data) || !object(data.user) || !text(data.user.id) || data.user.isDeactivated === true)
    throw new DevNetError("No active ledger user found. Complete wallet onboarding in the HackCanton DevNet wallet.", 403);
  const userId = text(data.user.id);
  const parties = partiesFromRights(await upstream(DEVNET_LEDGER + `/v2/users/${encodeURIComponent(userId)}/rights`, session.accessToken));
  if (!parties.length) throw new DevNetError("Your ledger user has no CanActAs Party. Onboard your DevNet wallet or ask the operator to grant your own Party rights.", 403);
  const partyId = session.partyId || (parties.includes(text(data.user.primaryParty)) ? text(data.user.primaryParty) : parties[0]);
  if (!parties.includes(partyId)) throw new DevNetError("The selected Party is no longer authorized. Sign in again.", 403);
  return { userId, partyId, parties };
}
async function discoverCcAdmin(token: string): Promise<string | undefined> {
  try {
    const value = await upstream(DEVNET_VALIDATOR + "/api/validator/v0/scan-proxy/dso-party-id", token);
    const party = typeof value === "string" ? value : object(value) ? text(value.dso_party_id || value.party_id || value.dsoPartyId) : "";
    return party.startsWith("DSO::") ? party : undefined;
  } catch { return undefined; } // CC discovery must not block a valid login.
}
function tokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    if (typeof payload.exp === "number" && Number.isFinite(payload.exp)) return Math.min(payload.exp * 1000, Date.now() + 3600000);
  } catch {}
  return Date.now() + 15 * 60000;
}
async function login(value: ObjectValue): Promise<Session> {
  key();
  let accessToken = text(value.accessToken).trim();
  if (!accessToken) {
    if (!text(value.username) || !text(value.password)) throw new DevNetError("Enter your HackCanton email and password.");
    const body = new URLSearchParams({ grant_type: "password", client_id: process.env.CANTON_DEVNET_OIDC_CLIENT_ID || "web-app-ui-hackcanton-01-devnet",
      username: text(value.username).trim(), password: text(value.password), scope: "openid daml_ledger_api", ...(text(value.totp) ? { totp: text(value.totp) } : {}) });
    const response = await fetch(TOKEN_URL, { method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000), headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    const tokens = await response.json();
    if (!response.ok || !object(tokens) || !text(tokens.access_token)) {
      const code = object(tokens) ? text(tokens.error) : "";
      if (["invalid_client", "unauthorized_client", "unsupported_grant_type"].includes(code))
        throw new DevNetError("The NODERS login client does not allow this sign-in method. Ask the operator for the permitted DevNet client ID, or use your own DevNet access token.", 503);
      throw new DevNetError("DevNet sign-in was rejected. Check your HackCanton credentials or use your own DevNet access token.", 401);
    }
    accessToken = text(tokens.access_token);
  }
  if (accessToken.length > 10000 || /\s/.test(accessToken)) throw new DevNetError("Enter a valid DevNet access token, without the Bearer prefix.");
  const session: Session = { accessToken, expiresAt: tokenExpiry(accessToken) };
  if (session.expiresAt <= Date.now()) throw new DevNetError("This access token has expired. Obtain a fresh DevNet token.", 401);
  return session;
}
export function checkedCommands(value: unknown, account: DevNetAccount): ObjectValue {
  if (!object(value) || !Array.isArray(value.commands) || !value.commands.length || value.commands.length > 50)
    throw new DevNetError("Invalid DevNet command submission.");
  if (!text(value.commandId) || text(value.commandId).length > 255) throw new DevNetError("A stable command ID is required.");
  for (const field of ["actAs", "readAs"]) {
    if (value[field] !== undefined && (!Array.isArray(value[field]) || !value[field].length || value[field].some(p => p !== account.partyId)))
      throw new DevNetError("This transaction must use only the selected DevNet Party.", 403);
  }
  if (!value.commands.every(c => object(c) && Object.keys(c).length === 1 &&
    (object(c.CreateCommand) || object(c.ExerciseCommand)))) throw new DevNetError("Unsupported DevNet command type.");
  return { commands: value.commands, commandId: value.commandId, userId: account.userId, actAs: [account.partyId], readAs: [account.partyId],
    ...(Array.isArray(value.disclosedContracts) ? { disclosedContracts: value.disclosedContracts } : {}),
    ...(text(value.synchronizerId) ? { synchronizerId: value.synchronizerId } : {}),
    ...(Array.isArray(value.packageIdSelectionPreference) ? { packageIdSelectionPreference: value.packageIdSelectionPreference } : {}) };
}
function digest(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function checkReadFilters(value: unknown, party: string): void {
  if (Array.isArray(value)) { for (const nested of value) checkReadFilters(nested, party); return; }
  if (!object(value)) return;
  for (const [name, nested] of Object.entries(value)) {
    if (name === "requestingParties" && (!Array.isArray(nested) || nested.some(p => p !== party))) throw new DevNetError("Ledger reads must use the selected DevNet Party.", 403);
    if (name === "filtersForAnyParty" && nested != null) throw new DevNetError("Use an explicit selected-Party filter.", 403);
    if (name === "filtersByParty" && (!object(nested) || Object.keys(nested).some(p => p !== party)))
      throw new DevNetError("Ledger reads must use the selected DevNet Party.", 403);
    checkReadFilters(nested, party);
  }
}
function result(value: unknown, request?: Request, session?: Session, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store", ...(request ? { "set-cookie": sessionCookie(request, session) } : {}) } });
}
function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  // Next may construct request.url with its internal hostname. Use the actual
  // incoming Host plus the deployment proxy's protocol, never an arbitrary URL.
  const host = request.headers.get("host") || url.host;
  const forwarded = request.headers.get("x-forwarded-proto");
  const protocol = forwarded === "https" || forwarded === "http" ? forwarded + ":" : url.protocol;
  return `${protocol}//${host}`;
}
export async function devNetApi(request: Request): Promise<Response> {
  try {
    if ((process.env.NEXT_PUBLIC_CANTON_NETWORK || "devnet").trim().toLowerCase() !== "devnet") throw new DevNetError("Sandbox login is available only on DevNet deployments.", 403);
    if (request.method !== "GET" && request.headers.get("origin") !== requestOrigin(request)) throw new DevNetError("Open VINSS on the same origin to authorize this request.", 403);
    if (request.method === "DELETE") return result({ disconnected: true }, request);
    if (request.method === "GET") {
      let session: Session;
      try { session = readSession(request); } catch (e) {
        if (e instanceof DevNetError && e.status === 401) return result({ authenticated: false, configured: /^[a-fA-F0-9]{64}$/.test(process.env.VINSS_DEVNET_SESSION_SECRET || "") });
        throw e;
      }
      return result({ authenticated: true, ...await accountFor(session), ccAdmin: await discoverCcAdmin(session.accessToken) });
    }
    if (request.method !== "POST") throw new DevNetError("Unsupported method.", 405);
    const raw = await request.text();
    if (raw.length > 2000000) throw new DevNetError("DevNet request is too large.", 413);
    const value: unknown = JSON.parse(raw);
    if (!object(value)) throw new DevNetError("Invalid DevNet request.");
    if (value.operation === "login") {
      const session = await login(value), account = await accountFor(session);
      session.partyId = account.partyId;
      return result({ authenticated: true, ...account, ccAdmin: await discoverCcAdmin(session.accessToken) }, request, session);
    }
    const session = readSession(request), account = await accountFor(session);
    if (value.operation === "select") {
      if (!account.parties.includes(text(value.partyId))) throw new DevNetError("This Party is not authorized for your user.", 403);
      session.partyId = text(value.partyId);
      return result({ ...account, partyId: session.partyId }, request, session);
    }
    if (value.operation === "prepare" || value.operation === "execute") {
      const commands = checkedCommands(value.params, account);
      if (value.operation === "prepare") return result({ ticket: seal({ digest: digest(commands), userId: account.userId, partyId: account.partyId, expiresAt: Date.now() + 180000 }, "approval") });
      let ticket: unknown;
      try { ticket = unseal(text(value.ticket), "approval"); }
      catch (error) { if (error instanceof DevNetError && error.status === 401) throw new DevNetError("Transaction approval is invalid. Review the transaction again.", 403); throw error; }
      if (!object(ticket) || typeof ticket.expiresAt !== "number" || ticket.expiresAt <= Date.now() || ticket.userId !== account.userId || ticket.partyId !== account.partyId || ticket.digest !== digest(commands))
        throw new DevNetError("Transaction approval expired or changed. Review the transaction again.", 403);
      return result(await upstream(DEVNET_LEDGER + "/v2/commands/submit-and-wait", session.accessToken, "POST", commands));
    }
    if (value.operation === "read") {
      const method = text(value.requestMethod).toUpperCase(), resource = text(value.resource);
      if (!((method === "GET" && resource === "/v2/state/ledger-end") || (method === "POST" && ["/v2/state/active-contracts", "/v2/updates", "/v2/updates/update-by-id", "/v2/events/events-by-contract-id"].includes(resource))))
        throw new DevNetError("This ledger resource is not available through sandbox reads.", 403);
      checkReadFilters(value.body, account.partyId);
      return result(await upstream(DEVNET_LEDGER + resource, session.accessToken, method, value.body));
    }
    if (value.operation === "registry") {
      const path = text(value.path);
      if (!(path === "/registry/allocation-instruction/v1/allocation-factory" || /^\/registry\/allocations\/v1\/[A-Za-z0-9_%:-]+\/choice-contexts\/execute-transfer$/.test(path)))
        throw new DevNetError("Unsupported DevNet registry request.", 403);
      if (path.includes("%") && /[/\\?#%]/.test(decodeURIComponent(path.slice("/registry/allocations/v1/".length).split("/")[0]))) throw new DevNetError("Invalid allocation identifier.");
      return result(await upstream(DEVNET_VALIDATOR + "/api/validator/v0/scan-proxy" + path, session.accessToken, "POST", value.body));
    }
    throw new DevNetError("Unknown DevNet operation.");
  } catch (error) {
    const known = error instanceof DevNetError;
    const response = result({ error: known ? error.message : "The DevNet service could not complete this request. Check its availability and retry." }, undefined, undefined, known ? error.status : 502);
    if (known && error.status === 401) response.headers.set("set-cookie", sessionCookie(request));
    return response;
  }
}
