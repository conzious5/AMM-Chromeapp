const test = require("node:test");
const assert = require("node:assert/strict");
const { DevelopmentAuthProvider } = require("../auth-provider.js");
const { ExtensionApiClient } = require("../extension-api-client.js");
const compose = require("../compose-adapter.js");

test("development auth implements sign-in, current-user, token, and sign-out", async () => {
  const auth = new DevelopmentAuthProvider({ senderAddresses: ["hello@authentic-moments.com"] }); await assert.rejects(() => auth.getCurrentUser(), /SIGN_IN_REQUIRED/); const user = await auth.signIn(); assert.equal(user.role, "DEVELOPMENT"); assert.equal(await auth.getAccessToken(), "development-mock-token"); await auth.signOut(); assert.equal(await auth.getAccessToken(), null);
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
  const fs = require("node:fs"); const path = require("node:path"); const source = fs.readFileSync(path.join(__dirname, "../content-script.js"), "utf8"); assert.equal(/\bSend\b.*\.click\s*\(/s.test(source), false); assert.equal(/data-tooltip\s*[*^$]?=\s*["']Send/i.test(source), false);
});
