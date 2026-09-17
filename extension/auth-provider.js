(function (root, factory) {
  const api = factory(); if (typeof module === "object" && module.exports) module.exports = api; root.AMMVoiceAuth = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function receiverSafeFetch(fetchImpl) { return fetchImpl ? (...args) => Reflect.apply(fetchImpl, globalThis, args) : (...args) => globalThis.fetch(...args); }
  function responseError(message, status) { const error = new Error(message); error.status = status; error.code = status === 401 || status === 403 ? "AUTH_REJECTED" : "HTTP_ERROR"; return error; }
  class ExtensionAuthProvider { async signIn() { throw new Error("Not implemented"); } async signOut() { throw new Error("Not implemented"); } async getAccessToken() { throw new Error("Not implemented"); } async getCurrentUser() { throw new Error("Not implemented"); } }
  class NativeExtensionAuthProvider extends ExtensionAuthProvider {
    constructor(chromeApi, settingsReader, fetchImpl) { super(); this.chrome = chromeApi; this.settingsReader = settingsReader; this.fetch = receiverSafeFetch(fetchImpl); }
    async tokenState() { return this.chrome.storage.session.get(["accessToken", "refreshToken", "currentUser"]); }
    async saveSession(value) {
      if (!value || typeof value.accessToken !== "string" || !value.accessToken || typeof value.refreshToken !== "string" || !value.refreshToken || !value.user || typeof value.user !== "object") throw new Error("MALFORMED_AUTH_RESPONSE");
      await this.chrome.storage.session.set({ accessToken: value.accessToken, refreshToken: value.refreshToken, currentUser: value.user });
    }
    async clearSession() { await this.chrome.storage.session.remove(["accessToken", "refreshToken", "currentUser"]); }
    async post(path, payload, accessToken) {
      const { backendUrl } = await this.settingsReader();
      const response = await this.fetch(`${backendUrl}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) }, body: payload ? JSON.stringify(payload) : undefined });
      const body = response.status === 204 ? {} : await response.json().catch(() => ({})); if (!response.ok) throw responseError(body.error || `Authentication failed (${response.status}).`, response.status); return body;
    }
    async signIn(credentials = {}) { const result = await this.post("/auth/extension/login", { email: credentials.email || "", password: credentials.password || "" }); await this.saveSession(result); return result.user; }
    async signOut() { const current = await this.tokenState(); try { if (current.accessToken) await this.post("/auth/extension/logout", null, current.accessToken); } catch { /* Local sign-out must still succeed when the backend is unavailable. */ } finally { await this.clearSession(); } }
    async getAccessToken() { return (await this.tokenState()).accessToken || null; }
    async getCurrentUser() { const current = await this.tokenState(); if (!current.accessToken) throw new Error("SIGN_IN_REQUIRED"); return current.currentUser || null; }
    async refreshAccessToken() { const current = await this.tokenState(); if (!current.refreshToken) return false; try { const result = await this.post("/auth/extension/refresh", { refreshToken: current.refreshToken }); await this.saveSession(result); return true; } catch (error) { if (error?.code === "AUTH_REJECTED") { await this.clearSession(); return false; } throw error; } }
  }
  class DevelopmentAuthProvider extends ExtensionAuthProvider {
    constructor(config = {}) { super(); this.config = config; this.signedIn = false; }
    async signIn() { this.signedIn = true; return this.getCurrentUser(); } async signOut() { this.signedIn = false; } async getAccessToken() { return this.signedIn ? "development-mock-token" : null; }
    async getCurrentUser() { if (!this.signedIn) throw new Error("SIGN_IN_REQUIRED"); return { authenticatedUser: this.config.authenticatedUser || "developer@amm-voice.local", name: this.config.name || "Developer", role: "DEVELOPMENT", senderAddresses: this.config.senderAddresses || ["hello@authentic-moments.com"] }; }
  }
  return { ExtensionAuthProvider, NativeExtensionAuthProvider, DevelopmentAuthProvider };
});
