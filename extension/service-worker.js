const DEFAULT_BACKEND = "https://ammserver-production.up.railway.app";
async function settings() { const value = await chrome.storage.local.get(["backendUrl", "authToken"]); return { backendUrl: (value.backendUrl || DEFAULT_BACKEND).replace(/\/$/, ""), authToken: value.authToken || "" }; }
async function signIn() {
  const { backendUrl } = await settings(); const redirectUri = chrome.identity.getRedirectURL("callback");
  const responseUrl = await chrome.identity.launchWebAuthFlow({ url: `${backendUrl}/auth/extension/start?redirect_uri=${encodeURIComponent(redirectUri)}`, interactive: true });
  if (!responseUrl) throw new Error("Google sign-in did not complete.");
  const token = new URL(responseUrl).hash.match(/(?:^#|&)token=([^&]+)/)?.[1];
  if (!token) throw new Error("The backend did not return an extension token.");
  await chrome.storage.local.set({ authToken: decodeURIComponent(token) }); return getConfig();
}
async function api(path, init = {}) {
  const { backendUrl, authToken } = await settings(); if (!authToken) throw new Error("SIGN_IN_REQUIRED");
  const response = await fetch(`${backendUrl}${path}`, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${authToken}`, ...(init.headers || {}) } });
  if (response.status === 401) { await chrome.storage.local.remove("authToken"); throw new Error("SIGN_IN_REQUIRED"); }
  const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || `AMM Voice request failed (${response.status}).`); return body;
}
function getConfig() { return api("/api/extension/config"); }
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "SIGN_IN") return signIn();
    if (message.type === "SIGN_OUT") { await chrome.storage.local.remove("authToken"); return { ok: true }; }
    if (message.type === "GET_CONFIG") return getConfig();
    if (message.type === "REWRITE") return api("/api/rewrite", { method: "POST", body: JSON.stringify(message.payload) });
    throw new Error("Unknown extension request.");
  })().then((result) => sendResponse({ ok: true, result })).catch((error) => sendResponse({ ok: false, error: error.message })); return true;
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
