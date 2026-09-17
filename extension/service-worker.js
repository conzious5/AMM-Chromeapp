importScripts("auth-provider.js", "extension-api-client.js", "core.js", "telemetry.js");

const DEFAULT_BACKEND = "https://ammserver-production.up.railway.app";
const workerFetch = (...args) => globalThis.fetch(...args);
const telemetry = new AMMVoiceTelemetry.NoopExtensionTelemetry();

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
  const auth = developmentAllowed
    ? new AMMVoiceAuth.DevelopmentAuthProvider({ senderAddresses: value.mockAuthorizedSenders })
    : new AMMVoiceAuth.NativeExtensionAuthProvider(chrome, settings, workerFetch);
  if (developmentAllowed) await auth.signIn();
  return { auth, client: new AMMVoiceApi.ExtensionApiClient({ backendUrl: value.backendUrl, auth, fetchImpl: workerFetch }) };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    const { auth, client } = await services();
    if (message.type === "SIGN_IN") { await auth.signIn({ email: message.email, password: message.password }); return client.getCurrentUser(); }
    if (message.type === "SIGN_OUT") { await auth.signOut(); return { ok: true }; }
    if (message.type === "GET_CONFIG") return client.getCurrentUser();
    if (message.type === "REWRITE") return client.rewriteEmail(message.payload);
    if (message.type === "RETRY_REWRITE") return client.retryRewrite(message.payload);
    if (message.type === "SUBMIT_FEEDBACK") return client.submitFeedback(message.payload);
    if (message.type === "TELEMETRY") { await telemetry.record(message.name, message.metadata); return { accepted: true }; }
    if (message.type === "OPEN_SETTINGS") { await chrome.runtime.openOptionsPage(); return { opened: true }; }
    throw new Error("Unknown extension request.");
  })().then((result) => sendResponse({ ok: true, result })).catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
