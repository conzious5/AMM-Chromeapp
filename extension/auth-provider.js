(function (root, factory) {
  const api = factory(); if (typeof module === "object" && module.exports) module.exports = api; root.AMMVoiceAuth = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const SESSION_KEYS = Object.freeze(["accessToken", "refreshToken", "currentUser"]);
  function receiverSafeFetch(fetchImpl) { return fetchImpl ? (...args) => Reflect.apply(fetchImpl, globalThis, args) : (...args) => globalThis.fetch(...args); }
  function responseError(message, status) { const error = new Error(message); error.status = status; error.code = status === 401 || status === 403 ? "AUTH_REJECTED" : "HTTP_ERROR"; return error; }
  class ExtensionAuthProvider { async signIn() { throw new Error("Not implemented"); } async signOut() { throw new Error("Not implemented"); } async getAccessToken() { throw new Error("Not implemented"); } async getCurrentUser() { throw new Error("Not implemented"); } }
  class NativeExtensionAuthProvider extends ExtensionAuthProvider {
    constructor(chromeApi, settingsReader, fetchImpl, diagnostic) { super(); this.chrome = chromeApi; this.settingsReader = settingsReader; this.fetch = receiverSafeFetch(fetchImpl); this.diagnostic = typeof diagnostic === "function" ? diagnostic : () => {}; this.refreshPromise = null; }
    async tokenState() { return this.chrome.storage.session.get(SESSION_KEYS); }
    async sessionStatus() { const current = await this.tokenState(); return { accessTokenPresent: Boolean(current.accessToken), refreshTokenPresent: Boolean(current.refreshToken), currentUserPresent: Boolean(current.currentUser), authenticated: Boolean(current.accessToken && current.refreshToken && current.currentUser) }; }
    async saveSession(value) {
      if (!value || typeof value.accessToken !== "string" || !value.accessToken || typeof value.refreshToken !== "string" || !value.refreshToken || !value.user || typeof value.user !== "object") throw new Error("MALFORMED_AUTH_RESPONSE");
      await this.chrome.storage.session.set({ accessToken: value.accessToken, refreshToken: value.refreshToken, currentUser: value.user });
      await this.diagnostic("auth_session_saved", { access_token_present: true, refresh_token_present: true, current_user_present: true });
    }
    async clearSession(expected = {}) {
      const current = await this.tokenState();
      if (expected.accessToken && current.accessToken !== expected.accessToken) return false;
      if (expected.refreshToken && current.refreshToken !== expected.refreshToken) return false;
      await this.chrome.storage.session.remove(SESSION_KEYS); return true;
    }
    async post(path, payload, accessToken) {
      const { backendUrl } = await this.settingsReader();
      const response = await this.fetch(`${backendUrl}${path}`, { method: "POST", headers: { ...(payload ? { "content-type": "application/json" } : {}), ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) }, body: payload ? JSON.stringify(payload) : undefined });
      const body = response.status === 204 ? {} : await response.json().catch(() => ({})); if (!response.ok) throw responseError(body.error || `Authentication failed (${response.status}).`, response.status); return body;
    }
    async signIn(credentials = {}) { const result = await this.post("/auth/extension/login", { email: credentials.email || "", password: credentials.password || "" }); await this.saveSession(result); await this.diagnostic("login_succeeded", { login_success: true }); return result.user; }
    async signOut() { const current = await this.tokenState(); try { if (current.accessToken) await this.post("/auth/extension/logout", null, current.accessToken); } catch { /* Local sign-out must still succeed when the backend is unavailable. */ } finally { await this.clearSession(); } }
    async getAccessToken() { return (await this.tokenState()).accessToken || null; }
    async getCurrentUser() { const current = await this.tokenState(); if (!current.accessToken) throw new Error("SIGN_IN_REQUIRED"); return current.currentUser || null; }
    async expireAccessToken(accessToken) { return this.clearSession({ accessToken }); }
    async refreshAccessToken() {
      if (this.refreshPromise) return this.refreshPromise;
      this.refreshPromise = (async () => {
        const current = await this.tokenState();
        await this.diagnostic("refresh_started", { refresh_attempted: true, refresh_token_present: Boolean(current.refreshToken) });
        if (!current.refreshToken) return false;
        try {
          const result = await this.post("/auth/extension/refresh", { refreshToken: current.refreshToken });
          const latest = await this.tokenState();
          if (latest.refreshToken !== current.refreshToken) { await this.diagnostic("refresh_superseded", { token_rotated: false }); return Boolean(latest.accessToken); }
          await this.saveSession(result); await this.diagnostic("refresh_succeeded", { refresh_response_status: 200, token_rotated: true }); return true;
        } catch (error) {
          if (error?.code === "AUTH_REJECTED") { const cleared = await this.clearSession({ refreshToken: current.refreshToken }); await this.diagnostic("refresh_rejected", { refresh_response_status: error.status || 401, token_rotated: false, session_cleared: cleared }); return false; }
          throw error;
        }
      })();
      try { return await this.refreshPromise; } finally { this.refreshPromise = null; }
    }
  }
  class DevelopmentAuthProvider extends ExtensionAuthProvider {
    constructor(config = {}) { super(); this.config = config; this.signedIn = false; }
    async signIn() { this.signedIn = true; return this.getCurrentUser(); } async signOut() { this.signedIn = false; } async getAccessToken() { return this.signedIn ? "development-mock-token" : null; }
    async getCurrentUser() { if (!this.signedIn) throw new Error("SIGN_IN_REQUIRED"); return { authenticatedUser: this.config.authenticatedUser || "developer@amm-voice.local", name: this.config.name || "Developer", role: "DEVELOPMENT", senderAddresses: this.config.senderAddresses || ["hello@authentic-moments.com"], emailCoachingEnabled: this.config.emailCoachingEnabled === true }; }
  }
  return { SESSION_KEYS, ExtensionAuthProvider, NativeExtensionAuthProvider, DevelopmentAuthProvider };
});
