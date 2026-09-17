(function (root, factory) {
  const api = factory(); if (typeof module === "object" && module.exports) module.exports = api; root.AMMVoiceAuthDiagnostics = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const STORAGE_KEY = "ammVoiceAuthDiagnosticsV1";
  const ALLOWED_FIELDS = new Set([
    "access_token_present", "refresh_token_present", "current_user_present", "login_success",
    "rewrite_authorization_header_present", "last_protected_request_status", "refresh_attempted",
    "refresh_response_status", "token_rotated", "session_cleared", "extension_instance_id",
    "service_worker_alive", "auth_storage_verified",
    "service_worker_authenticated"
  ]);
  function safeDetails(details = {}) {
    const safe = {};
    for (const [key, value] of Object.entries(details)) if (ALLOWED_FIELDS.has(key) && ["string", "number", "boolean"].includes(typeof value)) safe[key] = value;
    return safe;
  }
  function createRecorder(chromeApi, extensionId, clock = () => new Date().toISOString()) {
    return async function record(event, details = {}) {
      const safe = { event: String(event || "unknown").slice(0, 80), at: clock(), extension_instance_id: extensionId, ...safeDetails(details) };
      const current = await chromeApi.storage.session.get(STORAGE_KEY);
      const previous = current[STORAGE_KEY] && typeof current[STORAGE_KEY] === "object" ? current[STORAGE_KEY] : {};
      const history = [...(Array.isArray(previous.history) ? previous.history : []), safe].slice(-30);
      const lastProtected = safe.last_protected_request_status ?? previous.lastProtectedRequestStatus ?? "none";
      const next = { extensionInstanceId: extensionId, serviceWorkerAlive: true, lastProtectedRequestStatus: lastProtected, lastEvent: safe, history };
      await chromeApi.storage.session.set({ [STORAGE_KEY]: next });
      console.info("[AMM Voice diagnostics]", safe);
      return next;
    };
  }
  async function readDiagnostics(chromeApi, extensionId) {
    const current = await chromeApi.storage.session.get(STORAGE_KEY); const value = current[STORAGE_KEY] || {};
    return { extensionInstanceId: extensionId, serviceWorkerAlive: true, lastProtectedRequestStatus: value.lastProtectedRequestStatus || "none", lastEvent: value.lastEvent || null };
  }
  return { STORAGE_KEY, safeDetails, createRecorder, readDiagnostics };
});
