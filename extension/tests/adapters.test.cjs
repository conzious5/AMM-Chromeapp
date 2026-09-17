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
  const okClient = new ExtensionApiClient({ backendUrl: "http://localhost:3000/", auth, fetchImpl: async (url, init) => ({ status: 200, ok: true, async json() { return { url, method: init.method, payload: JSON.parse(init.body) }; } }) });
  const result = await okClient.retryRewrite({ mode: "zacs_edit", draft: "Draft" }); assert.equal(result.url, "http://localhost:3000/api/rewrite"); assert.equal(result.payload.mode, "zacs_edit");
  const unauthorized = new ExtensionApiClient({ backendUrl: "http://localhost:3000", auth, fetchImpl: async () => ({ status: 401, ok: false, async json() { return {}; } }) }); await assert.rejects(() => unauthorized.getCurrentUser(), /AUTHENTICATION_EXPIRED/); assert.equal(signedOut, true);
});

test("draft extraction excludes signature and quoted thread nodes", () => {
  const clone = { querySelectorAll() { return [{ remove() { clone.innerText = "Current draft"; } }, { remove() {} }]; }, innerText: "Current draft\nSignature\nQuoted history" };
  const body = { cloneNode() { return clone; } }; assert.equal(compose.draftText(body), "Current draft");
});

test("extension implementation contains no Gmail Send interaction", () => {
  const fs = require("node:fs"); const path = require("node:path"); const source = fs.readFileSync(path.join(__dirname, "../content-script.js"), "utf8"); const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "../manifest.json"), "utf8")); assert.equal(/\bSend\b.*\.click\s*\(/s.test(source), false); assert.equal(/data-tooltip\s*[*^$]?=\s*["']Send/i.test(source), false); assert.equal(manifest.permissions.includes("identity"), false);
});
