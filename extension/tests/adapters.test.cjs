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

test("default service-worker fetch wrappers preserve the WorkerGlobalScope receiver", async () => {
  const originalFetch = globalThis.fetch; const calls = [];
  globalThis.fetch = function (url, init) { if (this !== globalThis) throw new TypeError("Illegal invocation"); calls.push({ url, init }); const login = String(url).endsWith("/auth/extension/login"); return Promise.resolve({ ok: true, status: 200, async json() { return login ? { user: { email: "cylina@authentic-moments.com" }, accessToken: "access", refreshToken: "refresh" } : { authenticatedUser: "cylina@authentic-moments.com", senderAddresses: ["cylina@authentic-moments.com"] }; } }); };
  const values = {}; const chromeApi = { storage: { session: { async get(keys) { return Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]])); }, async set(next) { Object.assign(values, next); }, async remove(keys) { keys.forEach((key) => delete values[key]); } } } };
  try { const auth = new NativeExtensionAuthProvider(chromeApi, async () => ({ backendUrl: "https://backend.example" })); await auth.signIn({ email: "cylina@authentic-moments.com", password: "private" }); const client = new ExtensionApiClient({ backendUrl: "https://backend.example", auth }); const config = await client.getCurrentUser(); assert.equal(config.authenticatedUser, "cylina@authentic-moments.com"); assert.equal(calls.length, 2); } finally { globalThis.fetch = originalFetch; }
});

test("API client centralizes rewrite and expires unauthorized sessions", async () => {
  let signedOut = false; const auth = { async getAccessToken() { return "token"; }, async signOut() { signedOut = true; } };
  const okClient = new ExtensionApiClient({ backendUrl: "http://localhost:3000/", auth, fetchImpl: async (url, init) => ({ status: 200, ok: true, async json() { return { url, method: init.method, payload: JSON.parse(init.body), rewrittenText: "Safe rewrite", reviewNotes: [], warnings: [] }; } }) });
  const result = await okClient.retryRewrite({ mode: "zacs_edit", draft: "Draft" }); assert.equal(result.url, "http://localhost:3000/api/rewrite"); assert.equal(result.payload.mode, "zacs_edit");
  const unauthorized = new ExtensionApiClient({ backendUrl: "http://localhost:3000", auth, fetchImpl: async () => ({ status: 401, ok: false, async json() { return {}; } }) }); await assert.rejects(() => unauthorized.getCurrentUser(), /AUTHENTICATION_EXPIRED/); assert.equal(signedOut, true);
});

test("API client exposes one injectable outbound coaching operation with idempotency", async () => {
  const calls = []; const auth = { async getAccessToken() { return "token"; }, async signOut() {} }; const client = new ExtensionApiClient({ backendUrl: "https://backend.example", outboundCoachingPath: "/canonical/outbound-route", auth, fetchImpl: async (url, init) => { calls.push({ url, init }); return { status: 202, ok: true, async json() { return { accepted: true }; } }; } });
  const result = await client.submitOutboundEmailForCoaching({ eventId: "event-123", finalBody: "Private body" }); assert.equal(result.accepted, true); assert.equal(calls[0].url, "https://backend.example/canonical/outbound-route"); assert.equal(calls[0].init.headers["x-idempotency-key"], "event-123");
  const unintegrated = new ExtensionApiClient({ backendUrl: "https://backend.example", auth, fetchImpl: async () => { throw new Error("must not call"); } }); await assert.rejects(() => unintegrated.submitOutboundEmailForCoaching({ eventId: "event" }), /ENDPOINT_NOT_INTEGRATED/);
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

test("refresh-time runtime failures remain network failures and do not clear auth state", async () => {
  const values = { accessToken: "expired", refreshToken: "still-valid", currentUser: { email: "cylina@authentic-moments.com" } }; let signedOut = false; let requestCount = 0;
  const chromeApi = { storage: { session: { async get(keys) { return Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]])); }, async set(next) { Object.assign(values, next); }, async remove(keys) { keys.forEach((key) => delete values[key]); } } } };
  const auth = new NativeExtensionAuthProvider(chromeApi, async () => ({ backendUrl: "https://backend.example" }), async () => { throw new TypeError("Illegal invocation"); }); const originalSignOut = auth.signOut.bind(auth); auth.signOut = async () => { signedOut = true; return originalSignOut(); };
  const client = new ExtensionApiClient({ backendUrl: "https://backend.example", auth, fetchImpl: async () => { requestCount += 1; return { status: 401, ok: false, async json() { return {}; } }; } });
  await assert.rejects(() => client.getCurrentUser(), /Illegal invocation/); assert.equal(requestCount, 1); assert.equal(signedOut, false); assert.equal(values.refreshToken, "still-valid");
});

test("rejected refresh produces authentication expiration after exactly one refresh attempt", async () => {
  let refreshes = 0; let signedOut = false; let requests = 0; const auth = { async getAccessToken() { return "expired"; }, async refreshAccessToken() { refreshes += 1; return false; }, async signOut() { signedOut = true; } };
  const client = new ExtensionApiClient({ backendUrl: "https://backend.example", auth, fetchImpl: async () => { requests += 1; return { status: 401, ok: false, async json() { return {}; } }; } });
  await assert.rejects(() => client.getCurrentUser(), /AUTHENTICATION_EXPIRED/); assert.equal(refreshes, 1); assert.equal(requests, 1); assert.equal(signedOut, true);
});

test("generic fetch exceptions never sign out the user or become auth expiration", async () => {
  let signedOut = false; const auth = { async getAccessToken() { return "valid"; }, async refreshAccessToken() { throw new Error("refresh must not run"); }, async signOut() { signedOut = true; } };
  const client = new ExtensionApiClient({ backendUrl: "https://backend.example", auth, fetchImpl: async () => { throw new TypeError("Failed to fetch"); } });
  await assert.rejects(() => client.rewriteEmail({ mode: "amm_style", draft: "Original draft" }), /Failed to fetch/); assert.equal(signedOut, false);
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

test("outbound compose context reads current recipients and recognizes only Gmail Send", () => {
  function node(attributes = {}, value = "") { return { value, getAttribute(name) { return attributes[name] || null; }, closest(selector) { if (selector === ".amm-voice-shell") return null; if (selector.includes("from") && /from/i.test(attributes["aria-label"] || "")) return this; return null; } }; }
  const recipient = node({ email: "client@example.com" }); const cc = node({}, "producer@example.com"); const sender = node({ email: "hello@authentic-moments.com", "aria-label": "From: hello@authentic-moments.com" }); const quoted = node({ email: "old@example.com" }); const body = { getAttribute(name) { return name === "g_editable" ? "true" : null; }, cloneNode() { return { innerText: "Final body", querySelectorAll() { return []; } }; }, contains(candidate) { return candidate === quoted; } };
  const composeRoot = { contains() { return true; }, getAttribute() { return "compose-1"; }, querySelector(selector) { if (selector === 'input[name="subjectbox"]') return { value: "Re: Details" }; return null; }, querySelectorAll(selector) { if (selector === compose.BODY_SELECTOR) return [body]; if (selector.includes("[email]")) return [recipient, cc, sender, quoted]; return []; } };
  const result = compose.outboundContext(composeRoot, { querySelectorAll() { return []; }, querySelector() { return null; } }); assert.deepEqual(result.recipientAddresses, ["client@example.com", "producer@example.com"]); assert.equal(result.finalBody, "Final body"); assert.equal(result.composeMode, "reply");
  const send = node({ "aria-label": "Send" }); send.closest = (selector) => selector.includes("role") ? send : null; const sendLater = node({ "aria-label": "Send Later" }); sendLater.closest = (selector) => selector.includes("role") ? sendLater : null; assert.equal(compose.isSendControl(send, composeRoot), true); assert.equal(compose.isSendControl(sendLater, composeRoot), false);
});

test("extension implementation contains no Gmail Send interaction", () => {
  const fs = require("node:fs"); const path = require("node:path"); const source = fs.readFileSync(path.join(__dirname, "../content-script.js"), "utf8"); const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "../manifest.json"), "utf8")); assert.equal(/\bSend\b.*\.click\s*\(/s.test(source), false); assert.equal(/data-tooltip\s*[*^$]?=\s*["']Send/i.test(source), false); assert.equal(manifest.permissions.includes("identity"), false);
});

test("request failures cannot mutate a Gmail draft without an explicit Replace Draft click", () => {
  const fs = require("node:fs"); const path = require("node:path"); const source = fs.readFileSync(path.join(__dirname, "../content-script.js"), "utf8"); const replacementCalls = source.match(/Gmail\.replaceDraftBody\(/g) || [];
  const replaceHandler = source.indexOf('ui.replace.addEventListener("click"'); const replacementCall = source.indexOf("Gmail.replaceDraftBody(");
  assert.equal(replacementCalls.length, 1); assert.ok(replaceHandler >= 0); assert.ok(replacementCall > replaceHandler);
});
