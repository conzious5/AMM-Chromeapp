(function (root, factory) {
  const api = factory(); if (typeof module === "object" && module.exports) module.exports = api; root.AMMVoiceAuth = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  class ExtensionAuthProvider { async signIn() { throw new Error("Not implemented"); } async signOut() { throw new Error("Not implemented"); } async getAccessToken() { throw new Error("Not implemented"); } async getCurrentUser() { throw new Error("Not implemented"); } }
  class NativeExtensionAuthProvider extends ExtensionAuthProvider {
    constructor(chromeApi, settingsReader, fetchImpl = fetch) { super(); this.chrome = chromeApi; this.settingsReader = settingsReader; this.fetch = fetchImpl; }
    async tokenState() { return this.chrome.storage.session.get(["accessToken", "refreshToken", "currentUser"]); }
    async saveSession(value) { await this.chrome.storage.session.set({ accessToken: value.accessToken, refreshToken: value.refreshToken, currentUser: value.user }); }
    async clearSession() { await this.chrome.storage.session.remove(["accessToken", "refreshToken", "currentUser"]); }
    async post(path, payload, accessToken) {
      const { backendUrl } = await this.settingsReader();
      const response = await this.fetch(`${backendUrl}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) }, body: payload ? JSON.stringify(payload) : undefined });
      const body = response.status === 204 ? {} : await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || `Authentication failed (${response.status}).`); return body;
    }
    async signIn(credentials = {}) { const result = await this.post("/auth/extension/login", { email: credentials.email || "", password: credentials.password || "" }); await this.saveSession(result); return result.user; }
    async signOut() { const current = await this.tokenState(); try { if (current.accessToken) await this.post("/auth/extension/logout", null, current.accessToken); } catch { /* Local sign-out must still succeed when the backend is unavailable. */ } finally { await this.clearSession(); } }
    async getAccessToken() { return (await this.tokenState()).accessToken || null; }
    async getCurrentUser() { const current = await this.tokenState(); if (!current.accessToken) throw new Error("SIGN_IN_REQUIRED"); return current.currentUser || null; }
    async refreshAccessToken() { const current = await this.tokenState(); if (!current.refreshToken) return false; try { const result = await this.post("/auth/extension/refresh", { refreshToken: current.refreshToken }); await this.saveSession(result); return true; } catch { await this.clearSession(); return false; } }
  }
  class DevelopmentAuthProvider extends ExtensionAuthProvider {
    constructor(config = {}) { super(); this.config = config; this.signedIn = false; }
    async signIn() { this.signedIn = true; return this.getCurrentUser(); } async signOut() { this.signedIn = false; } async getAccessToken() { return this.signedIn ? "development-mock-token" : null; }
    async getCurrentUser() { if (!this.signedIn) throw new Error("SIGN_IN_REQUIRED"); return { authenticatedUser: this.config.authenticatedUser || "developer@amm-voice.local", name: this.config.name || "Developer", role: "DEVELOPMENT", senderAddresses: this.config.senderAddresses || ["hello@authentic-moments.com"] }; }
  }
  return { ExtensionAuthProvider, NativeExtensionAuthProvider, DevelopmentAuthProvider };
});
