const test = require("node:test");
const assert = require("node:assert/strict");
const { DevelopmentAuthProvider, NativeExtensionAuthProvider } = require("../auth-provider.js");
const { ExtensionApiClient } = require("../extension-api-client.js");
const compose = require("../compose-adapter.js");

test("development auth implements sign-in, current-user, token, and sign-out", async () => {
  const auth = new DevelopmentAuthProvider({ senderAddresses: ["hello@authentic-moments.com"] }); await assert.rejects(() => auth.getCurrentUser(), /SIGN_IN_REQUIRED/); const user = await auth.signIn(); assert.equal(user.role, "DEVELOPMENT"); assert.equal(await auth.getAccessToken(), "development-mock-token"); await auth.signOut(); assert.equal(await auth.getAccessToken(), null);
});

test("native auth keeps rotating tokens in session storage and never stores the password", async () => {
  const values = {}; const chromeApi = { storage: { session: { async get(keys) { return Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]])); }, async set(next) { Object.assign(values, next); }, async remove(keys) { keys.forEach((key) => delete values[key]); } } } };
  const responses = [
    { user: { email: "cylina@authentic-moments.com" }, accessToken: "access-1", refreshToken: "refresh-1" },
    { user: { email: "cylina@authentic-moments.com" }, accessToken: "access-2", refreshToken: "refresh-2" },
    {}
  ];
  const requests = []; const auth = new NativeExtensionAuthProvider(chromeApi, async () => ({ backendUrl: "https://backend.example" }), async (url, init) => { requests.push({ url, body: init.body }); return { ok: true, status: url.endsWith("logout") ? 204 : 200, async json() { return responses.shift(); } }; });
  await auth.signIn({ email: "cylina@authentic-moments.com", password: "never-store-this" }); assert.equal(await auth.getAccessToken(), "access-1"); assert.equal(Object.values(values).includes("never-store-this"), false);
  assert.equal(await auth.refreshAccessToken(), true); assert.equal(await auth.getAccessToken(), "access-2"); assert.match(requests[1].body, /refresh-1/); await auth.signOut(); assert.equal(await auth.getAccessToken(), null);
});

test("API client centralizes rewrite and expires unauthorized sessions", async () => {
  let signedOut = false; const auth = { async getAccessToken() { return "token"; }, async signOut() { signedOut = true; } };
  const okClient = new ExtensionApiClient({ backendUrl: "http://localhost:3000/", auth, fetchImpl: async (url, init) => ({ status: 200, ok: true, async json() { return { url, method: init.method, payload: JSON.parse(init.body), rewrittenText: "Safe rewrite", reviewNotes: [], warnings: [] }; } }) });
  const result = await okClient.retryRewrite({ mode: "zacs_edit", draft: "Draft" }); assert.equal(result.url, "http://localhost:3000/api/rewrite"); assert.equal(result.payload.mode, "zacs_edit");
  const unauthorized = new ExtensionApiClient({ backendUrl: "http://localhost:3000", auth, fetchImpl: async () => ({ status: 401, ok: false, async json() { return {}; } }) }); await assert.rejects(() => unauthorized.getCurrentUser(), /AUTHENTICATION_EXPIRED/); assert.equal(signedOut, true);
});

test("API client makes exactly one refresh attempt after an expired access token", async () => {
  let refreshes = 0; let requests = 0; let token = "expired";
  const auth = { async getAccessToken() { return token; }, async refreshAccessToken() { refreshes += 1; token = "fresh"; return true; }, async signOut() { throw new Error("should not sign out"); } };
  const client = new ExtensionApiClient({ backendUrl: "https://backend.example", auth, fetchImpl: async (_url, init) => { requests += 1; if (init.headers.authorization === "Bearer expired") return { status: 401, ok: false, async json() { return {}; } }; return { status: 200, ok: true, async json() { return { authenticatedUser: "cylina@authentic-moments.com", senderAddresses: ["cylina@authentic-moments.com"] }; } }; } });
  const config = await client.getCurrentUser(); assert.equal(config.authenticatedUser, "cylina@authentic-moments.com"); assert.equal(refreshes, 1); assert.equal(requests, 2);
});

test("failed refresh clears native session and revoked authentication fails safely", async () => {
  const values = { accessToken: "expired", refreshToken: "revoked", currentUser: { email: "cylina@authentic-moments.com" } };
  const chromeApi = { storage: { session: { async get(keys) { return Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]])); }, async set(next) { Object.assign(values, next); }, async remove(keys) { keys.forEach((key) => delete values[key]); } } } };
  const auth = new NativeExtensionAuthProvider(chromeApi, async () => ({ backendUrl: "https://backend.example" }), async () => ({ ok: false, status: 401, async json() { return { error: "Invalid refresh token" }; } }));
  assert.equal(await auth.refreshAccessToken(), false); assert.deepEqual(values, {});
});

test("malformed API success responses are rejected without producing replaceable text", async () => {
  const auth = { async getAccessToken() { return "token"; }, async signOut() {} };
  const client = new ExtensionApiClient({ backendUrl: "https://backend.example", auth, fetchImpl: async () => ({ status: 200, ok: true, async json() { return { success: true }; } }) });
  await assert.rejects(() => client.rewriteEmail({ mode: "amm_style", draft: "Safe original" }), /MALFORMED_REWRITE_RESPONSE/);
});

test("logout clears local auth state even when the backend is unavailable", async () => {
  const values = { accessToken: "access", refreshToken: "refresh", currentUser: { email: "cylina@authentic-moments.com" } };
  const chromeApi = { storage: { session: { async get(keys) { return Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]])); }, async set(next) { Object.assign(values, next); }, async remove(keys) { keys.forEach((key) => delete values[key]); } } } };
  const auth = new NativeExtensionAuthProvider(chromeApi, async () => ({ backendUrl: "https://backend.example" }), async () => { throw new Error("offline"); });
  await auth.signOut(); assert.deepEqual(values, {});
});

test("draft extraction excludes signature and quoted thread nodes", () => {
  const clone = { querySelectorAll() { return [{ remove() { clone.innerText = "Current draft"; } }, { remove() {} }]; }, innerText: "Current draft\nSignature\nQuoted history" };
  const body = { cloneNode() { return clone; } }; assert.equal(compose.draftText(body), "Current draft");
});

test("real-Gmail body and panel anchors avoid the AI prompt and hidden toolbars", () => {
  const aiPrompt = { getAttribute(name) { return name === "aria-label" ? "Describe your message" : null; } }; const body = { getAttribute(name) { return name === "g_editable" ? "true" : name === "aria-label" ? "Message Body" : null; } };
  const sendTable = { parentElement: { id: "visible-bottom-row" } }; const send = { closest(name) { return name === "table" ? sendTable : null; } };
  const composeRoot = { querySelectorAll(selector) { return selector === compose.BODY_SELECTOR ? [body, aiPrompt] : []; }, querySelector(selector) { return selector.includes("aria-label=\"Send\"") ? send : null; } };
  assert.equal(compose.findBody(composeRoot), body); assert.deepEqual(compose.composeMount(composeRoot), { parent: sendTable.parentElement, before: sendTable });
});

test("extension implementation contains no Gmail Send interaction", () => {
  const fs = require("node:fs"); const path = require("node:path"); const source = fs.readFileSync(path.join(__dirname, "../content-script.js"), "utf8"); const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "../manifest.json"), "utf8")); assert.equal(/\bSend\b.*\.click\s*\(/s.test(source), false); assert.equal(/data-tooltip\s*[*^$]?=\s*["']Send/i.test(source), false); assert.equal(manifest.permissions.includes("identity"), false);
});
