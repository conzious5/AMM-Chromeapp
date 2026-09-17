(function (root, factory) {
  const api = factory(); if (typeof module === "object" && module.exports) module.exports = api; root.AMMVoiceApi = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function receiverSafeFetch(fetchImpl) { return fetchImpl ? (...args) => Reflect.apply(fetchImpl, globalThis, args) : (...args) => globalThis.fetch(...args); }
  function responseError(response, body = {}) {
    const status = Number(response?.status) || 0; const serverMessage = typeof body.error === "string" ? body.error : "";
    let code = "API_FAILURE"; let message = serverMessage || `API failure (${status})`;
    if (status === 400) { code = "INVALID_REQUEST"; message = "AMM Voice received an invalid rewrite request."; }
    else if (status === 403 && /sender/i.test(serverMessage)) { code = "UNAUTHORIZED_SENDER"; message = "This From address is not authorized for your AMM Voice account."; }
    else if (status === 403) { code = "AUTHORIZATION_DENIED"; message = "AMM Voice did not authorize this request."; }
    else if (status === 429) { code = "RATE_LIMIT"; message = "AMM Voice is receiving several requests. Wait a moment and try again."; }
    else if (status === 502 && /rewrite failed/i.test(serverMessage)) { code = "MODEL_FAILURE"; message = "The AMM Voice model could not complete the rewrite."; }
    else if ([500, 502, 503, 504].includes(status)) { code = "BACKEND_UNAVAILABLE"; message = "AMM Voice is temporarily unavailable."; }
    const error = new Error(message); error.code = code; error.status = status; return error;
  }
  class ExtensionApiClient {
    constructor(options) { this.backendUrl = options.backendUrl.replace(/\/$/, ""); this.auth = options.auth; this.fetch = receiverSafeFetch(options.fetchImpl); this.timeoutMs = options.timeoutMs || 30000; this.outboundCoachingPath = options.outboundCoachingPath || ""; this.diagnostic = typeof options.diagnostic === "function" ? options.diagnostic : () => {}; }
    async request(path, init = {}, retry = true) {
      let token = await this.auth.getAccessToken();
      if (!token && retry && this.auth.sessionStatus && this.auth.refreshAccessToken) {
        const status = await this.auth.sessionStatus();
        if (status.refreshTokenPresent) { await this.diagnostic("missing_access_token", { access_token_present: false, refresh_token_present: true }); if (await this.auth.refreshAccessToken()) return this.request(path, init, false); throw new Error("AUTHENTICATION_EXPIRED"); }
      }
      if (!token) { await this.diagnostic("protected_request_blocked", { access_token_present: false, last_protected_request_status: "not_sent" }); throw new Error("SIGN_IN_REQUIRED"); }
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetch(`${this.backendUrl}${path}`, { ...init, signal: controller.signal, headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init.headers || {}) } });
        await this.diagnostic("protected_response", { rewrite_authorization_header_present: true, last_protected_request_status: response.status });
        if (response.status === 401 && retry && this.auth.refreshAccessToken && await this.auth.refreshAccessToken()) return this.request(path, init, false);
        if (response.status === 401) { if (this.auth.expireAccessToken) await this.auth.expireAccessToken(token); else await this.auth.signOut(); throw new Error("AUTHENTICATION_EXPIRED"); }
        const body = await response.json().catch(() => ({})); if (!response.ok) throw responseError(response, body); return body;
      } finally { clearTimeout(timeout); }
    }
    async getCurrentUser() {
      const value = await this.request("/api/extension/config");
      if (!value || typeof value.authenticatedUser !== "string" || !Array.isArray(value.senderAddresses)) throw new Error("MALFORMED_CONFIG_RESPONSE");
      return { ...value, emailCoachingEnabled: value.emailCoachingEnabled === true };
    }
    async getAuthorizedSenders() { return (await this.getCurrentUser()).senderAddresses || []; }
    async rewriteEmail(payload) {
      const value = await this.request("/api/rewrite", { method: "POST", body: JSON.stringify(payload) });
      if (!value || typeof value.rewrittenText !== "string" || !value.rewrittenText.trim() || !Array.isArray(value.reviewNotes) || !Array.isArray(value.warnings)) { const error = new Error("AMM Voice returned an incomplete rewrite response."); error.code = "MALFORMED_RESPONSE"; throw error; }
      return value;
    }
    retryRewrite(payload) { return this.rewriteEmail(payload); }
    async submitOutboundEmailForCoaching(payload) { if (!this.outboundCoachingPath) throw new Error("EMAIL_COACHING_ENDPOINT_NOT_INTEGRATED"); const value = await this.request(this.outboundCoachingPath, { method: "POST", headers: { "x-idempotency-key": payload.eventId }, body: JSON.stringify(payload) }); if (!value || value.accepted !== true) throw new Error("MALFORMED_EMAIL_COACHING_RESPONSE"); return value; }
    async submitFeedback(_feedback) { return { accepted: false, reason: "Canonical feedback endpoint is not integrated." }; }
  }
  return { responseError, ExtensionApiClient };
});
