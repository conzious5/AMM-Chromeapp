const DEFAULT_BACKEND = "https://ammserver-production.up.railway.app";
async function backendUrl() { const value = await chrome.storage.local.get("backendUrl"); return (value.backendUrl || DEFAULT_BACKEND).replace(/\/$/, ""); }
async function tokens() { return chrome.storage.session.get(["accessToken", "refreshToken"]); }
async function saveTokens(value) { await chrome.storage.session.set({ accessToken: value.accessToken, refreshToken: value.refreshToken }); }
async function clearTokens() { await chrome.storage.session.remove(["accessToken", "refreshToken"]); }
async function signIn(email, password) {
  const backend = await backendUrl();
  const response = await fetch(`${backend}/auth/extension/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Sign in failed.");
  await saveTokens(body); return getConfig();
}
async function refreshAccess() {
  const backend = await backendUrl(); const current = await tokens();
  if (!current.refreshToken) return false;
  const response = await fetch(`${backend}/auth/extension/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: current.refreshToken }) });
  if (!response.ok) { await clearTokens(); return false; }
  await saveTokens(await response.json()); return true;
}
async function api(path, init = {}, retry = true) {
  const backend = await backendUrl(); const current = await tokens();
  if (!current.accessToken) throw new Error("SIGN_IN_REQUIRED");
  const response = await fetch(`${backend}${path}`, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${current.accessToken}`, ...(init.headers || {}) } });
  if (response.status === 401 && retry && await refreshAccess()) return api(path, init, false);
  if (response.status === 401) { await clearTokens(); throw new Error("SIGN_IN_REQUIRED"); }
  if (response.status === 204) return { ok: true };
  const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || `AMM Voice request failed (${response.status}).`); return body;
}
function getConfig() { return api("/api/extension/config"); }
async function signOut() { try { await api("/auth/extension/logout", { method: "POST" }, false); } finally { await clearTokens(); } return { ok: true }; }
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "SIGN_IN") return signIn(message.email, message.password);
    if (message.type === "SIGN_OUT") return signOut();
    if (message.type === "GET_CONFIG") return getConfig();
    if (message.type === "REWRITE") return api("/api/rewrite", { method: "POST", body: JSON.stringify(message.payload) });
    throw new Error("Unknown extension request.");
  })().then((result) => sendResponse({ ok: true, result })).catch((error) => sendResponse({ ok: false, error: error.message })); return true;
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
