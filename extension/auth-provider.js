(function (root, factory) {
  const api = factory(); if (typeof module === "object" && module.exports) module.exports = api; root.AMMVoiceAuth = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  class ExtensionAuthProvider { async signIn() { throw new Error("Not implemented"); } async signOut() { throw new Error("Not implemented"); } async getAccessToken() { throw new Error("Not implemented"); } async getCurrentUser() { throw new Error("Not implemented"); } }
  class BackendExtensionAuthProvider extends ExtensionAuthProvider {
    constructor(chromeApi, settingsReader) { super(); this.chrome = chromeApi; this.settingsReader = settingsReader; }
    async signIn() { const { backendUrl } = await this.settingsReader(); const redirectUri = this.chrome.identity.getRedirectURL("callback"); const responseUrl = await this.chrome.identity.launchWebAuthFlow({ url: `${backendUrl}/auth/extension/start?redirect_uri=${encodeURIComponent(redirectUri)}`, interactive: true }); if (!responseUrl) throw new Error("Sign-in did not complete."); const token = new URL(responseUrl).hash.match(/(?:^#|&)token=([^&]+)/)?.[1]; if (!token) throw new Error("The backend did not return an extension token."); await this.chrome.storage.local.set({ authToken: decodeURIComponent(token) }); return this.getCurrentUser(); }
    async signOut() { await this.chrome.storage.local.remove("authToken"); }
    async getAccessToken() { return (await this.settingsReader()).authToken || null; }
    async getCurrentUser() { return { accessToken: await this.getAccessToken() }; }
  }
  class DevelopmentAuthProvider extends ExtensionAuthProvider {
    constructor(config = {}) { super(); this.config = config; this.signedIn = false; }
    async signIn() { this.signedIn = true; return this.getCurrentUser(); } async signOut() { this.signedIn = false; } async getAccessToken() { return this.signedIn ? "development-mock-token" : null; }
    async getCurrentUser() { if (!this.signedIn) throw new Error("SIGN_IN_REQUIRED"); return { authenticatedUser: this.config.authenticatedUser || "developer@amm-voice.local", name: this.config.name || "Developer", role: "DEVELOPMENT", senderAddresses: this.config.senderAddresses || ["hello@authentic-moments.com"] }; }
  }
  return { ExtensionAuthProvider, BackendExtensionAuthProvider, DevelopmentAuthProvider };
});
