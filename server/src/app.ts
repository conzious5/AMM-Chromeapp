import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import path from "node:path";
import type { AppConfig } from "./config.js";
import { rewriteRequestSchema } from "./schemas/rewrite.js";
import type { AuthService } from "./services/auth.js";
import type { RewriteService } from "./services/rewriteService.js";
import type { AnalyticsRepository } from "./services/analyticsRepository.js";
import { registerPortalAuth, requirePortalUser } from "./services/portalAuth.js";

export async function buildApp(input: { config: AppConfig; auth: AuthService; rewriteService: RewriteService; analytics: AnalyticsRepository }) {
  const app = Fastify({
    logger: {
      level: input.config.NODE_ENV === "test" ? "silent" : "info",
      redact: ["req.headers.authorization"]
    },
    bodyLimit: 128 * 1024
  });
  const origins = input.config.ALLOWED_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);
  await app.register(cors, { origin: origins.length ? origins : false });
  await app.register(rateLimit, { max: input.config.RATE_LIMIT_MAX, timeWindow: input.config.RATE_LIMIT_WINDOW });
  await registerPortalAuth(app, input.config, input.analytics);

  app.get("/health", async () => ({ status: "ok" }));

  async function authenticate(header: string | undefined) { return input.auth.authenticate(header); }

  function senderPermissions(email: string): string[] {
    try {
      const permissions = JSON.parse(input.config.USER_SENDER_PERMISSIONS_JSON) as Record<string, unknown>;
      const values = permissions[email.toLowerCase()];
      return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string").map((value) => value.toLowerCase()) : [email.toLowerCase()];
    } catch { return [email.toLowerCase()]; }
  }

  app.get("/api/extension/config", async (request, reply) => {
    const principal = await authenticate(request.headers.authorization);
    if (!principal) return reply.code(401).send({ error: "Unauthorized" });
    return { authenticatedUser: principal.email, name: principal.name ?? principal.email, role: principal.role ?? "TEAM", senderAddresses: senderPermissions(principal.email) };
  });

  app.post("/api/rewrite", async (request, reply) => {
    const startedAt = performance.now();
    const requestId = randomUUID();
    const principal = await authenticate(request.headers.authorization);
    if (!principal) return reply.code(401).send({ success: false, error: "Unauthorized", requestId });
    const parsed = rewriteRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "Invalid request", details: parsed.error.flatten(), requestId });
    if (parsed.data.senderAddress && !senderPermissions(principal.email).includes(parsed.data.senderAddress.toLowerCase())) {
      return reply.code(403).send({ success: false, error: "Sender address is not permitted for this user", requestId });
    }
    try {
      const result = await input.rewriteService.rewrite(parsed.data, requestId);
      const latencyMs = Math.round(performance.now() - startedAt);
      const interventions = parsed.data.mode === "zacs_edit" ? result.reviewNotes : [];
      input.analytics.record({
        requestId, actorId: principal.id, authenticatedUser: principal.email, mode: parsed.data.mode,
        ...(parsed.data.senderAddress ? { senderAddress: parsed.data.senderAddress } : {}),
        ...(parsed.data.recipientAddress ? { recipientAddress: parsed.data.recipientAddress } : {}),
        ...(parsed.data.conversationId ? { conversationId: parsed.data.conversationId } : {}),
        latencyMs, model: input.config.OPENAI_MODEL,
        ...(result.usage?.inputTokens !== undefined ? { inputTokens: result.usage.inputTokens } : {}),
        ...(result.usage?.outputTokens !== undefined ? { outputTokens: result.usage.outputTokens } : {}),
        warnings: result.warnings, interventions,
        frictionSignals: result.warnings.filter((warning) => /defensive|cold|unanswered|contradiction/i.test(warning)),
        attentionSignals: result.warnings.filter((warning) => /unsupported|promise|missing/i.test(warning))
      }).catch((error) => request.log.warn({ requestId, error }, "analytics event was not persisted"));
      request.log.info({
        requestId, authenticatedUser: principal.email, senderAddress: parsed.data.senderAddress, mode: parsed.data.mode,
        latencyMs, usage: result.usage, success: true
      }, "rewrite completed");
      return { success: true, rewrittenText: result.rewrittenText, reviewNotes: result.reviewNotes, warnings: result.warnings, requestId };
    } catch (error) {
      request.log.error({ requestId, authenticatedUser: principal.email, senderAddress: parsed.data.senderAddress, mode: parsed.data.mode, latencyMs: Math.round(performance.now() - startedAt), success: false, error }, "rewrite failed");
      return reply.code(502).send({ success: false, error: "Rewrite failed", requestId });
    }
  });

  app.get("/api/portal/overview", { preHandler: requirePortalUser }, async (request) => {
    const query = request.query as { days?: string; source?: "LIVE" | "HISTORICAL_CORPUS"; authenticatedUser?: string; senderAddress?: string };
    const days = Math.min(Math.max(Number(query.days) || 30, 1), 365);
    return input.analytics.overview(days, query.source ?? "LIVE", { ...(query.authenticatedUser ? { authenticatedUser: query.authenticatedUser } : {}), ...(query.senderAddress ? { senderAddress: query.senderAddress } : {}) });
  });

  app.get("/api/portal/metric-definitions", { preHandler: requirePortalUser }, async () => ({
    oneReplyResolutionRate: { type: "AI_CLASSIFICATION", definition: "Share of substantive questions or issues that appear resolved by AMM's next response without another clarification on the same issue.", limitation: "Approximate; acknowledgments such as ‘Thanks’ are excluded from unresolved follow-ups." },
    attentionFlags: { type: "AI_CLASSIFICATION", definition: "Observable signals such as repeated follow-ups, explicit concern, unresolved confusion, or a missed expectation.", limitation: "A flag requests review and does not establish client sentiment." },
    usageCounts: { type: "MEASURED_DATA", definition: "Completed AMM Style and Zac's Edit operations recorded by the live application.", limitation: "Activity before analytics storage was enabled is not included." }
  }));

  const publicRoot = path.resolve(process.cwd(), "public");
  if (existsSync(publicRoot)) {
    await app.register(fastifyStatic, { root: publicRoot, prefix: "/" });
    app.setNotFoundHandler(async (request, reply) => {
      if (request.raw.url?.startsWith("/api/") || request.raw.url?.startsWith("/auth/")) return reply.code(404).send({ error: "Not found" });
      return reply.sendFile("index.html");
    });
  }
  return app;
}
