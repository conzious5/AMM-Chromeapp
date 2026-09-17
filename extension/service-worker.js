importScripts("auth-provider.js", "extension-api-client.js", "auth-diagnostics.js", "core.js", "telemetry.js");

const DEFAULT_BACKEND = "https://ammserver-production.up.railway.app";
const workerFetch = (...args) => globalThis.fetch(...args);
const telemetry = new AMMVoiceTelemetry.NoopExtensionTelemetry();
const extensionInstanceId = chrome.runtime.id;
const recordDiagnostic = AMMVoiceAuthDiagnostics.createRecorder(chrome, extensionInstanceId);
let serviceCache = null;
console.info("[AMM Voice diagnostics]", { extension_instance_id: extensionInstanceId, context: "service_worker", service_worker_alive: true });
recordDiagnostic("service_worker_started", { service_worker_alive: true }).catch(() => {});

async function settings() {
  const value = await chrome.storage.local.get(["backendUrl", "developmentMode", "mockAuthorizedSenders"]);
  return {
    backendUrl: (value.backendUrl || DEFAULT_BACKEND).replace(/\/$/, ""),
    developmentMode: Boolean(value.developmentMode),
    mockAuthorizedSenders: Array.isArray(value.mockAuthorizedSenders) ? value.mockAuthorizedSenders : ["hello@authentic-moments.com", "cylina@authentic-moments.com"]
  };
}

async function services() {
  const value = await settings();
  const developmentAllowed = value.developmentMode && /^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(value.backendUrl);
  const cacheKey = JSON.stringify({ backendUrl: value.backendUrl, developmentAllowed, mockAuthorizedSenders: value.mockAuthorizedSenders });
  if (serviceCache?.key === cacheKey) return serviceCache.value;
  const auth = developmentAllowed
    ? new AMMVoiceAuth.DevelopmentAuthProvider({ senderAddresses: value.mockAuthorizedSenders })
    : new AMMVoiceAuth.NativeExtensionAuthProvider(chrome, settings, workerFetch, recordDiagnostic);
  if (developmentAllowed) await auth.signIn();
  const result = { auth, client: new AMMVoiceApi.ExtensionApiClient({ backendUrl: value.backendUrl, auth, fetchImpl: workerFetch, diagnostic: recordDiagnostic }) };
  serviceCache = { key: cacheKey, value: result }; return result;
}

async function authStatus(auth) {
  const status = auth.sessionStatus ? await auth.sessionStatus() : { accessTokenPresent: Boolean(await auth.getAccessToken()), refreshTokenPresent: false, currentUserPresent: true, authenticated: true };
  const diagnostics = await AMMVoiceAuthDiagnostics.readDiagnostics(chrome, extensionInstanceId);
  return { extensionInstanceId, ...status, authRestored: status.authenticated, authStatus: status.authenticated ? "signed_in" : status.refreshTokenPresent ? "refresh_available" : "signed_out", lastProtectedRequestStatus: diagnostics.lastProtectedRequestStatus };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    const { auth, client } = await services();
    if (message.type === "GET_AUTH_STATUS") return authStatus(auth);
    if (message.type === "SIGN_IN") {
      await auth.signIn({ email: message.email, password: message.password });
      const config = await client.getCurrentUser(); const status = await authStatus(auth);
      if (!status.authenticated) throw new Error("AUTH_STORAGE_VERIFICATION_FAILED");
      await recordDiagnostic("post_login_verified", { auth_storage_verified: true, service_worker_authenticated: true, access_token_present: status.accessTokenPresent, refresh_token_present: status.refreshTokenPresent, current_user_present: status.currentUserPresent });
      return { ...config, authStatus: status };
    }
    if (message.type === "SIGN_OUT") { await auth.signOut(); return { ok: true }; }
    if (message.type === "GET_CONFIG") return client.getCurrentUser();
    if (message.type === "REWRITE") return client.rewriteEmail(message.payload);
    if (message.type === "RETRY_REWRITE") return client.retryRewrite(message.payload);
    if (message.type === "SUBMIT_OUTBOUND_EMAIL_COACHING") return client.submitOutboundEmailForCoaching(message.payload);
    if (message.type === "SUBMIT_FEEDBACK") return client.submitFeedback(message.payload);
    if (message.type === "TELEMETRY") { await telemetry.record(message.name, message.metadata); return { accepted: true }; }
    if (message.type === "OPEN_SETTINGS") { await chrome.runtime.openOptionsPage(); return { opened: true, extensionInstanceId }; }
    throw new Error("Unknown extension request.");
  })().then((result) => sendResponse({ ok: true, result })).catch((error) => sendResponse({ ok: false, error: { code: error.code || "UNKNOWN", message: error.message || "AMM Voice request failed.", status: Number(error.status) || 0 } }));
  return true;
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
