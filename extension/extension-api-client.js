(function (root, factory) {
  const api = factory(); if (typeof module === "object" && module.exports) module.exports = api; root.AMMVoiceApi = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  class ExtensionApiClient {
    constructor(options) { this.backendUrl = options.backendUrl.replace(/\/$/, ""); this.auth = options.auth; this.fetch = options.fetchImpl || fetch; this.timeoutMs = options.timeoutMs || 30000; }
    async request(path, init = {}, retry = true) { const token = await this.auth.getAccessToken(); if (!token) throw new Error("SIGN_IN_REQUIRED"); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.timeoutMs); try { const response = await this.fetch(`${this.backendUrl}${path}`, { ...init, signal: controller.signal, headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init.headers || {}) } }); if (response.status === 401 && retry && this.auth.refreshAccessToken && await this.auth.refreshAccessToken()) return this.request(path, init, false); if (response.status === 401) { await this.auth.signOut(); throw new Error("AUTHENTICATION_EXPIRED"); } const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || `API failure (${response.status})`); return body; } finally { clearTimeout(timeout); } }
    getCurrentUser() { return this.request("/api/extension/config"); } async getAuthorizedSenders() { return (await this.getCurrentUser()).senderAddresses || []; }
    rewriteEmail(payload) { return this.request("/api/rewrite", { method: "POST", body: JSON.stringify(payload) }); } retryRewrite(payload) { return this.rewriteEmail(payload); }
    async submitFeedback(_feedback) { return { accepted: false, reason: "Canonical feedback endpoint is not integrated." }; }
  }
  return { ExtensionApiClient };
});
