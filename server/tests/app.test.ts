import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import type { LanguageModel } from "../src/types.js";
import { DevelopmentTokenAuth } from "../src/services/auth.js";
import { RewriteService } from "../src/services/rewriteService.js";
import { AnalyticsRepository } from "../src/services/analyticsRepository.js";
import type { NativeAuthService } from "../src/services/nativeAuth.js";

const testConfig: AppConfig = {
  NODE_ENV: "test", OPENAI_MODEL: "test", DEV_AUTH_TOKEN: "1234567890123456", PORT: 3000, HOST: "127.0.0.1",
  ALLOWED_ORIGINS: "", MAX_DRAFT_CHARS: 12000, MAX_THREAD_CHARS: 30000, RATE_LIMIT_MAX: 30, RATE_LIMIT_WINDOW: "1 minute",
  PUBLIC_BASE_URL: "http://localhost:3000", USER_SENDER_PERMISSIONS_JSON: "{}"
};
const repository = { async getContext() { return { voiceProfile: {}, principles: {}, businessRules: {}, examples: [] }; } };
const model: LanguageModel = {
  async generateRewrite() { return { rewrittenText: "Warm rewrite", reviewNotes: [], warnings: [] }; },
  async analyzeTrainingPair() { return {}; }
};
const unusedNativeAuth = {} as NativeAuthService;

describe("API", () => {
  it("has a public health endpoint", async () => {
    const app = await buildApp({ config: testConfig, auth: new DevelopmentTokenAuth(testConfig.DEV_AUTH_TOKEN), nativeAuth: unusedNativeAuth, rewriteService: new RewriteService(repository, model), analytics: new AnalyticsRepository() });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    await app.close();
  });
  it("requires authentication for rewrites", async () => {
    const app = await buildApp({ config: testConfig, auth: new DevelopmentTokenAuth(testConfig.DEV_AUTH_TOKEN), nativeAuth: unusedNativeAuth, rewriteService: new RewriteService(repository, model), analytics: new AnalyticsRepository() });
    const response = await app.inject({ method: "POST", url: "/api/rewrite", payload: { mode: "amm_style", draft: "Hello", subject: "", thread: "" } });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
  it("authorizes sender addresses separately from the authenticated human", async () => {
    const config = { ...testConfig, USER_SENDER_PERMISSIONS_JSON: JSON.stringify({ "development@amm-voice.local": ["hello@authentic-moments.com"] }) };
    const app = await buildApp({ config, auth: new DevelopmentTokenAuth(config.DEV_AUTH_TOKEN), nativeAuth: unusedNativeAuth, rewriteService: new RewriteService(repository, model), analytics: new AnalyticsRepository() });
    const headers = { authorization: `Bearer ${config.DEV_AUTH_TOKEN}` };
    const identity = await app.inject({ method: "GET", url: "/api/extension/config", headers });
    expect(identity.json()).toMatchObject({ authenticatedUser: "development@amm-voice.local", senderAddresses: ["hello@authentic-moments.com"] });
    const response = await app.inject({ method: "POST", url: "/api/rewrite", headers, payload: { mode: "amm_style", draft: "Hello", subject: "", thread: "", senderAddress: "hello@authentic-moments.com" } });
    expect(response.statusCode).toBe(200);
    await app.close();
  });
  it("enforces the ADMIN role on user administration routes", async () => {
    const nativeAuth = {
      authenticatePortal: async () => ({ id: "team-user", email: "cylina@authentic-moments.com", name: "Cylina", role: "TEAM" })
    } as unknown as NativeAuthService;
    const app = await buildApp({ config: testConfig, auth: new DevelopmentTokenAuth(testConfig.DEV_AUTH_TOKEN), nativeAuth, rewriteService: new RewriteService(repository, model), analytics: new AnalyticsRepository() });
    const response = await app.inject({ method: "GET", url: "/api/admin/users", headers: { cookie: "amm_voice_session=opaque-session-token" } });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
  it("sets an HttpOnly SameSite portal cookie after native login", async () => {
    const nativeAuth = {
      login: async () => ({
        user: { id: "admin-user", email: "admin@authentic-moments.com", name: "AMM Administrator", role: "ADMIN", active: true },
        accessToken: "opaque-access-token", accessExpiresAt: new Date(Date.now() + 60_000).toISOString()
      })
    } as unknown as NativeAuthService;
    const app = await buildApp({ config: testConfig, auth: new DevelopmentTokenAuth(testConfig.DEV_AUTH_TOKEN), nativeAuth, rewriteService: new RewriteService(repository, model), analytics: new AnalyticsRepository() });
    const response = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "admin@authentic-moments.com", password: "private-password" } });
    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toContain("amm_voice_session=opaque-access-token");
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Strict");
    await app.close();
  });
  it("rejects production browser login without the configured Origin", async () => {
    const config = { ...testConfig, NODE_ENV: "production" as const, PUBLIC_BASE_URL: "https://voice.example.com" };
    const app = await buildApp({ config, auth: new DevelopmentTokenAuth(config.DEV_AUTH_TOKEN), nativeAuth: unusedNativeAuth, rewriteService: new RewriteService(repository, model), analytics: new AnalyticsRepository() });
    const response = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "admin@authentic-moments.com", password: "private-password" } });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
