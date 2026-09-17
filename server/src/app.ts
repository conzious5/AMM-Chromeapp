import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { AppConfig } from "./config.js";
import { rewriteRequestSchema } from "./schemas/rewrite.js";
import type { AuthService } from "./services/auth.js";
import type { RewriteService } from "./services/rewriteService.js";

export async function buildApp(input: { config: AppConfig; auth: AuthService; rewriteService: RewriteService }) {
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

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/api/rewrite", async (request, reply) => {
    const startedAt = performance.now();
    const requestId = randomUUID();
    const principal = await input.auth.authenticate(request.headers.authorization);
    if (!principal) return reply.code(401).send({ success: false, error: "Unauthorized", requestId });
    const parsed = rewriteRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "Invalid request", details: parsed.error.flatten(), requestId });
    try {
      const result = await input.rewriteService.rewrite(parsed.data, requestId);
      request.log.info({
        requestId, user: principal.id, mode: parsed.data.mode,
        latencyMs: Math.round(performance.now() - startedAt), usage: result.usage, success: true
      }, "rewrite completed");
      return { success: true, rewrittenText: result.rewrittenText, reviewNotes: result.reviewNotes, warnings: result.warnings, requestId };
    } catch (error) {
      request.log.error({ requestId, user: principal.id, mode: parsed.data.mode, latencyMs: Math.round(performance.now() - startedAt), success: false, error }, "rewrite failed");
      return reply.code(502).send({ success: false, error: "Rewrite failed", requestId });
    }
  });
  return app;
}
