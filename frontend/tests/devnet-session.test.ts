import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { devNetApi, seal, unseal, DEVNET_LEDGER, DEVNET_VALIDATOR } from "../lib/server/devnet-session";

const origin = "https://vinss.example", party = "alice::123", other = "alice-other::123";
const token = "private-ledger-token";
const params = { commandId: "stable-command", actAs: [party], commands: [{ CreateCommand: { templateId: "#vinss:Deal:DealProposal", createArguments: { client: party } } }] };
let rights = [party, other], deactivated = false;
let requests: { url: string; init?: RequestInit }[];
function post(value: unknown, cookie?: string, requestOrigin = origin) {
  return devNetApi(new Request(origin + "/api/devnet", { method: "POST", headers: { origin: requestOrigin, "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(value) }));
}
function cookie() { return "vinss_devnet_session=" + seal({ accessToken: token, expiresAt: Date.now() + 600000, partyId: party }, "session"); }
beforeEach(() => {
  rights = [party, other]; deactivated = false; requests = [];
  vi.stubEnv("VINSS_DEVNET_SESSION_SECRET", "a".repeat(64));
  vi.stubEnv("NEXT_PUBLIC_CANTON_NETWORK", "devnet");
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); requests.push({ url, init });
    if (url.endsWith("/token")) return Response.json({ access_token: token });
    if (url.endsWith("/authenticated-user")) return Response.json({ user: { id: "alice-user", primaryParty: party, isDeactivated: deactivated } });
    if (url.endsWith("/rights")) return Response.json({ rights: rights.map(p => ({ kind: { CanActAs: { value: { party: p } } } })) });
    if (url.endsWith("/dso-party-id")) return Response.json({ dso_party_id: "DSO::live-network" });
    if (url.endsWith("/submit-and-wait")) return Response.json({ updateId: "ledger-update", completionOffset: 42 });
    if (url.includes("/registry/")) return Response.json({ factoryId: "factory", choiceContext: { choiceContextData: {}, disclosedContracts: [] } });
    if (url.endsWith("/ledger-end")) return Response.json({ offset: 42 });
    return Response.json([]);
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("DevNet session and authority", () => {
  it("requires a server key and never sends login credentials upstream to the ledger", async () => {
    vi.stubEnv("VINSS_DEVNET_SESSION_SECRET", "");
    expect((await post({ operation: "login", username: "alice@example.com", password: "password" })).status).toBe(503);
    expect(requests).toHaveLength(0);
  });
  it("validates password login against the ledger and stores only an encrypted HttpOnly session", async () => {
    const response = await post({ operation: "login", username: "alice@example.com", password: "password" });
    expect(response.status).toBe(200);
    const body = await response.json(), stored = response.headers.get("set-cookie")!;
    expect(body).toMatchObject({ authenticated: true, partyId: party, parties: [party, other], ccAdmin: "DSO::live-network" });
    expect(JSON.stringify(body)).not.toContain(token);
    expect(stored).toContain("HttpOnly; SameSite=Strict"); expect(stored).toContain("Secure");
    expect(stored).not.toContain(token); expect(stored).not.toContain("password");
    const session = unseal(stored.split(";")[0].split("=")[1], "session");
    expect(session).toMatchObject({ accessToken: token, partyId: party });
    expect(session).not.toHaveProperty("password");
    const grant = requests.find(r => r.url.endsWith("/token"))!;
    expect(new URLSearchParams(String(grant.init?.body)).get("client_id")).toBe("web-app-ui-hackcanton-01-devnet");
    for (const request of requests.filter(r => !r.url.endsWith("/token"))) {
      expect(request.init?.headers).toHaveProperty("authorization", `Bearer ${token}`);
      expect(String(request.init?.body)).not.toContain("password");
    }
  });
  it("restores only authenticated users with CanActAs and rejects removed Party rights", async () => {
    const good = await devNetApi(new Request(origin + "/api/devnet", { headers: { cookie: cookie() } }));
    expect(await good.json()).toMatchObject({ authenticated: true, partyId: party });
    rights = [];
    expect((await post({ operation: "login", accessToken: token })).status).toBe(403);
    rights = [other];
    expect((await post({ operation: "read", requestMethod: "get", resource: "/v2/state/ledger-end" }, cookie())).status).toBe(403);
  });
  it("rejects a deactivated ledger user", async () => {
    deactivated = true;
    expect((await post({ operation: "login", accessToken: token })).status).toBe(403);
  });
  it("rejects invalid tokens by querying the ledger, without trusting their JWT payload", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ secret: token }, { status: 401 })));
    const response = await post({ operation: "login", accessToken: token });
    expect(response.status).toBe(401); expect(await response.text()).not.toContain(token);
  });
  it("checks encryption purpose, tampering, and expiry", async () => {
    const encoded = seal({ accessToken: token, expiresAt: Date.now() - 100 }, "session");
    expect(() => unseal(encoded, "approval")).toThrow();
    expect(() => unseal("0" + encoded.slice(1), "session")).toThrow();
    const response = await post({ operation: "read" }, "vinss_devnet_session=" + encoded);
    expect(response.status).toBe(401); expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("blocks cross-origin authorization and non-DevNet deployments", async () => {
    expect((await post({ operation: "login", accessToken: token }, undefined, "https://attacker.example")).status).toBe(403);
    vi.stubEnv("NEXT_PUBLIC_CANTON_NETWORK", "mainnet");
    expect((await post({ operation: "login", accessToken: token })).status).toBe(403);
    expect(requests).toHaveLength(0);
  });
  it("validates the real incoming Host when Next uses an internal hostname", async () => {
    const request = (originHeader: string) => new Request("http://localhost:3000/api/devnet", { method: "POST", headers: { host: "vinss.example", "x-forwarded-proto": "https", origin: originHeader, "content-type": "application/json" }, body: JSON.stringify({ operation: "login", accessToken: token }) });
    const response = await devNetApi(request(origin));
    expect(response.status).toBe(200); expect(response.headers.get("set-cookie")).toContain("Secure");
    expect((await devNetApi(request("https://attacker.example"))).status).toBe(403);
  });
  it("permits selection only among the authenticated user's CanActAs Parties", async () => {
    expect((await post({ operation: "select", partyId: "stranger::123" }, cookie())).status).toBe(403);
    const response = await post({ operation: "select", partyId: other }, cookie());
    expect(await response.json()).toMatchObject({ partyId: other });
    const selected = response.headers.get("set-cookie")!.split(";")[0];
    expect(await (await devNetApi(new Request(origin + "/api/devnet", { headers: { cookie: selected } }))).json()).toMatchObject({ partyId: other });
  });
  it("clears the session on explicit disconnect", async () => {
    const response = await devNetApi(new Request(origin + "/api/devnet", { method: "DELETE", headers: { origin, cookie: cookie() } }));
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

describe("DevNet ledger proxy and explicit approval", () => {
  it("returns public setup status without exposing credentials", async () => {
    const response = await devNetApi(new Request(origin + "/api/devnet"));
    expect(await response.json()).toEqual({ authenticated: false, configured: true }); expect(requests).toHaveLength(0);
  });
  it("allows a ledger read but blocks write resources, arbitrary URLs and foreign Party filters", async () => {
    const session = cookie();
    expect(await (await post({ operation: "read", requestMethod: "get", resource: "/v2/state/ledger-end" }, session)).json()).toEqual({ offset: 42 });
    for (const resource of ["/v2/commands/submit-and-wait", "https://attacker.example", "/v2/users"]) {
      expect((await post({ operation: "read", requestMethod: "post", resource }, session)).status).toBe(403);
    }
    expect((await post({ operation: "read", requestMethod: "post", resource: "/v2/updates", body: { updateFormat: { eventFormat: { filtersByParty: { "stranger::123": {} } } } } }, session)).status).toBe(403);
    expect(requests.filter(r => r.url.endsWith("/submit-and-wait"))).toHaveLength(0);
  });
  it("prepares without executing, then submits exactly the approved envelope with real ledger identity", async () => {
    const session = cookie();
    const prepared = await (await post({ operation: "prepare", params }, session)).json();
    expect(requests.filter(r => r.url.endsWith("/submit-and-wait"))).toHaveLength(0);
    const response = await post({ operation: "execute", params, ticket: prepared.ticket }, session);
    expect(await response.json()).toEqual({ updateId: "ledger-update", completionOffset: 42 });
    const submission = requests.find(r => r.url.endsWith("/submit-and-wait"))!;
    expect(JSON.parse(String(submission.init?.body))).toEqual({ ...params, userId: "alice-user", readAs: [party] });
    expect(submission.url).toBe(DEVNET_LEDGER + "/v2/commands/submit-and-wait");
  });
  it("rejects altered commands, missing/expired tickets, another Party and readAs escalation", async () => {
    const session = cookie(), prepared = await (await post({ operation: "prepare", params }, session)).json();
    expect((await post({ operation: "execute", params: { ...params, commandId: "altered" }, ticket: prepared.ticket }, session)).status).toBe(403);
    expect((await post({ operation: "execute", params }, session)).status).toBe(403);
    const ticket = seal({ ...unseal(prepared.ticket, "approval") as object, expiresAt: Date.now() - 1 }, "approval");
    expect((await post({ operation: "execute", params, ticket }, session)).status).toBe(403);
    for (const field of ["actAs", "readAs"]) expect((await post({ operation: "prepare", params: { ...params, [field]: [other] } }, session)).status).toBe(403);
    expect(requests.filter(r => r.url.endsWith("/submit-and-wait"))).toHaveLength(0);
  });
  it("uses only the fixed CC registry and preserves the v1 allocation path", async () => {
    const path = "/registry/allocations/v1/cid%3A123/choice-contexts/execute-transfer";
    expect((await post({ operation: "registry", path, body: { meta: {} } }, cookie())).status).toBe(200);
    expect(requests.at(-1)?.url).toBe(DEVNET_VALIDATOR + "/api/validator/v0/scan-proxy" + path);
    expect((await post({ operation: "registry", path: "/registry/allocations/v1/cid%2Fother/choice-contexts/execute-transfer" }, cookie())).status).toBe(400);
    expect((await post({ operation: "registry", path: "https://attacker.example" }, cookie())).status).toBe(403);
  });
  it("reports invalid credentials and forbidden grant types without leaking upstream data", async () => {
    for (const error of ["invalid_grant", "unauthorized_client"]) {
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error, error_description: token }, { status: 401 })));
      const response = await post({ operation: "login", username: "alice@example.com", password: "password" });
      expect(response.status).toBe(error === "invalid_grant" ? 401 : 503); expect(await response.text()).not.toContain(token);
    }
  });
});
