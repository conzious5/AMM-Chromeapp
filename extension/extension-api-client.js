(function (root, factory) {
  const api = factory(); if (typeof module === "object" && module.exports) module.exports = api; root.AMMVoiceApi = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function receiverSafeFetch(fetchImpl) { return fetchImpl ? (...args) => Reflect.apply(fetchImpl, globalThis, args) : (...args) => globalThis.fetch(...args); }
  class ExtensionApiClient {
    constructor(options) { this.backendUrl = options.backendUrl.replace(/\/$/, ""); this.auth = options.auth; this.fetch = receiverSafeFetch(options.fetchImpl); this.timeoutMs = options.timeoutMs || 30000; this.outboundCoachingPath = options.outboundCoachingPath || ""; }
    async request(path, init = {}, retry = true) { const token = await this.auth.getAccessToken(); if (!token) throw new Error("SIGN_IN_REQUIRED"); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.timeoutMs); try { const response = await this.fetch(`${this.backendUrl}${path}`, { ...init, signal: controller.signal, headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init.headers || {}) } }); if (response.status === 401 && retry && this.auth.refreshAccessToken && await this.auth.refreshAccessToken()) return this.request(path, init, false); if (response.status === 401) { await this.auth.signOut(); throw new Error("AUTHENTICATION_EXPIRED"); } const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || `API failure (${response.status})`); return body; } finally { clearTimeout(timeout); } }
    async getCurrentUser() {
      const value = await this.request("/api/extension/config");
      if (!value || typeof value.authenticatedUser !== "string" || !Array.isArray(value.senderAddresses)) throw new Error("MALFORMED_CONFIG_RESPONSE");
      return { ...value, emailCoachingEnabled: value.emailCoachingEnabled === true };
    }
    async getAuthorizedSenders() { return (await this.getCurrentUser()).senderAddresses || []; }
    async rewriteEmail(payload) {
      const value = await this.request("/api/rewrite", { method: "POST", body: JSON.stringify(payload) });
      if (!value || typeof value.rewrittenText !== "string" || !value.rewrittenText.trim() || !Array.isArray(value.reviewNotes) || !Array.isArray(value.warnings)) throw new Error("MALFORMED_REWRITE_RESPONSE");
      return value;
    }
    retryRewrite(payload) { return this.rewriteEmail(payload); }
    async submitOutboundEmailForCoaching(payload) { if (!this.outboundCoachingPath) throw new Error("EMAIL_COACHING_ENDPOINT_NOT_INTEGRATED"); const value = await this.request(this.outboundCoachingPath, { method: "POST", headers: { "x-idempotency-key": payload.eventId }, body: JSON.stringify(payload) }); if (!value || value.accepted !== true) throw new Error("MALFORMED_EMAIL_COACHING_RESPONSE"); return value; }
    async submitFeedback(_feedback) { return { accepted: false, reason: "Canonical feedback endpoint is not integrated." }; }
  }
  return { ExtensionApiClient };
});
