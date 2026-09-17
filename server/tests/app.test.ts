import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import type { LanguageModel } from "../src/types.js";
import { DevelopmentTokenAuth } from "../src/services/auth.js";
import { RewriteService } from "../src/services/rewriteService.js";

const testConfig: AppConfig = {
  NODE_ENV: "test", OPENAI_MODEL: "test", DEV_AUTH_TOKEN: "1234567890123456", PORT: 3000, HOST: "127.0.0.1",
  ALLOWED_ORIGINS: "", MAX_DRAFT_CHARS: 12000, MAX_THREAD_CHARS: 30000, RATE_LIMIT_MAX: 30, RATE_LIMIT_WINDOW: "1 minute"
};
const repository = { async getContext() { return { voiceProfile: {}, principles: {}, businessRules: {}, examples: [] }; } };
const model: LanguageModel = {
  async generateRewrite() { return { rewrittenText: "Warm rewrite", reviewNotes: [], warnings: [] }; },
  async analyzeTrainingPair() { return {}; }
};

describe("API", () => {
  it("has a public health endpoint", async () => {
    const app = await buildApp({ config: testConfig, auth: new DevelopmentTokenAuth(testConfig.DEV_AUTH_TOKEN), rewriteService: new RewriteService(repository, model) });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    await app.close();
  });
  it("requires authentication for rewrites", async () => {
    const app = await buildApp({ config: testConfig, auth: new DevelopmentTokenAuth(testConfig.DEV_AUTH_TOKEN), rewriteService: new RewriteService(repository, model) });
    const response = await app.inject({ method: "POST", url: "/api/rewrite", payload: { mode: "amm_style", draft: "Hello", subject: "", thread: "" } });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
