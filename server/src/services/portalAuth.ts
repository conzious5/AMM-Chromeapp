import cookie from "@fastify/cookie";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { AuthPrincipal } from "./auth.js";
import type { AnalyticsRepository } from "./analyticsRepository.js";
import { AuthenticationError, NativeAuthService } from "./nativeAuth.js";

const SESSION_COOKIE = "amm_voice_session";
const loginSchema = z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(256), remember: z.boolean().optional() }).strict();
const refreshSchema = z.object({ refreshToken: z.string().min(32).max(256) }).strict();
const passwordSchema = z.object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().min(12).max(256) }).strict();
const createUserSchema = z.object({
  email: z.string().trim().email().max(320), displayName: z.string().trim().min(1).max(160), role: z.enum(["ADMIN", "TEAM"]),
  password: z.string().min(12).max(256), senderAddresses: z.array(z.string().trim().email().max(320)).max(20).optional()
}).strict();
const resetPasswordSchema = z.object({ password: z.string().min(12).max(256) }).strict();

declare module "fastify" {
  interface FastifyRequest { portalUser?: AuthPrincipal; portalSessionToken?: string; }
}

function cookieOptions(config: AppConfig, remember = false) {
  return { path: "/", httpOnly: true, sameSite: "strict" as const, secure: config.NODE_ENV === "production", maxAge: remember ? 30 * 24 * 60 * 60 : 8 * 60 * 60 };
}

function safeError(error: unknown): { status: number; message: string } {
  if (error instanceof AuthenticationError) return { status: error.code === "ACCOUNT_LOCKED" ? 429 : 401, message: error.message };
  if (error instanceof z.ZodError) return { status: 400, message: "Invalid request." };
  return { status: 400, message: error instanceof Error ? error.message : "Request failed." };
}

function trustedBrowserRequest(request: FastifyRequest, config: AppConfig): boolean {
  if (config.NODE_ENV !== "production") return true;
  const origin = request.headers.origin;
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(config.PUBLIC_BASE_URL).origin; } catch { return false; }
}

function requireTrustedOrigin(request: FastifyRequest, reply: FastifyReply, config: AppConfig): boolean {
  if (trustedBrowserRequest(request, config)) return true;
  void reply.code(403).send({ error: "Untrusted request origin." });
  return false;
}

export function requirePortalUser(auth: NativeAuthService) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const token = request.cookies[SESSION_COOKIE];
    const user = await auth.authenticatePortal(token);
    if (!user) { await reply.code(401).send({ error: "Authentication required" }); return; }
    request.portalUser = user;
    if (token) request.portalSessionToken = token;
  };
}

export function requireAdmin(auth: NativeAuthService) {
  const requireUser = requirePortalUser(auth);
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireUser(request, reply);
    if (reply.sent) return;
    if (request.portalUser?.role !== "ADMIN") await reply.code(403).send({ error: "Administrator access required." });
  };
}

export async function registerPortalAuth(app: FastifyInstance, config: AppConfig, analytics: AnalyticsRepository, auth: NativeAuthService): Promise<void> {
  await app.register(cookie);
  const portalUser = requirePortalUser(auth);
  const adminUser = requireAdmin(auth);

  app.post("/auth/login", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, config)) return;
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid email or password." });
    try {
      const result = await auth.login(parsed.data.email, parsed.data.password, "PORTAL", parsed.data.remember ?? false);
      reply.setCookie(SESSION_COOKIE, result.accessToken, cookieOptions(config, parsed.data.remember));
      await analytics.audit(result.user.email, "login_success", { method: "native_password" });
      return { authenticated: true, user: result.user };
    } catch (error) {
      await analytics.audit(parsed.data.email.toLowerCase(), "login_denied", { method: "native_password" });
      const safe = safeError(error);
      return reply.code(safe.status).send({ error: safe.message });
    }
  });

  app.get("/auth/me", async (request, reply) => {
    const user = await auth.authenticatePortal(request.cookies[SESSION_COOKIE]);
    return user ? { authenticated: true, user } : reply.code(401).send({ authenticated: false });
  });

  app.post("/auth/logout", async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, config)) return;
    const token = request.cookies[SESSION_COOKIE];
    const user = await auth.authenticatePortal(token);
    await auth.revokeToken(token);
    if (user) await analytics.audit(user.email, "logout");
    reply.clearCookie(SESSION_COOKIE, cookieOptions(config));
    return reply.code(204).send();
  });

  app.post("/auth/logout-all", { preHandler: portalUser }, async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, config)) return;
    await auth.revokeAll(request.portalUser!.id);
    await analytics.audit(request.portalUser!.email, "logout_all_sessions");
    reply.clearCookie(SESSION_COOKIE, cookieOptions(config));
    return reply.code(204).send();
  });

  app.post("/auth/change-password", { preHandler: portalUser, config: { rateLimit: { max: 5, timeWindow: "5 minutes" } } }, async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, config)) return;
    const parsed = passwordSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "The new password must be at least 12 characters." });
    try {
      await auth.changePassword(request.portalUser!.id, parsed.data.currentPassword, parsed.data.newPassword);
      await analytics.audit(request.portalUser!.email, "password_changed");
      reply.clearCookie(SESSION_COOKIE, cookieOptions(config));
      return reply.code(204).send();
    } catch (error) {
      const safe = safeError(error);
      return reply.code(safe.status).send({ error: safe.message });
    }
  });

  app.post("/auth/extension/login", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid email or password." });
    try {
      const result = await auth.login(parsed.data.email, parsed.data.password, "EXTENSION");
      await analytics.audit(result.user.email, "extension_login_success", { method: "native_password" });
      return result;
    } catch (error) {
      await analytics.audit(parsed.data.email.toLowerCase(), "extension_login_denied", { method: "native_password" });
      const safe = safeError(error);
      return reply.code(safe.status).send({ error: safe.message });
    }
  });

  app.post("/auth/extension/refresh", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(401).send({ error: "Session refresh failed." });
    try { return await auth.refreshExtension(parsed.data.refreshToken); }
    catch { return reply.code(401).send({ error: "Session refresh failed." }); }
  });

  app.post("/auth/extension/logout", async (request, reply) => {
    await auth.revokeBearer(request.headers.authorization);
    return reply.code(204).send();
  });

  app.get("/api/admin/users", { preHandler: adminUser }, async () => ({ users: await auth.listUsers() }));

  app.post("/api/admin/users", { preHandler: adminUser }, async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, config)) return;
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid user details." });
    try {
      const user = await auth.createUser({
        email: parsed.data.email,
        displayName: parsed.data.displayName,
        role: parsed.data.role,
        password: parsed.data.password,
        ...(parsed.data.senderAddresses ? { senderAddresses: parsed.data.senderAddresses } : {})
      });
      await analytics.audit(request.portalUser!.email, "user_created", { targetUser: user.email, role: user.role });
      return reply.code(201).send({ user });
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error && /unique/i.test(error.message) ? "That email already exists." : "Unable to create user." });
    }
  });

  app.post("/api/admin/users/:id/reset-password", { preHandler: adminUser }, async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, config)) return;
    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "The new password must be at least 12 characters." });
    try {
      const targetId = (request.params as { id: string }).id;
      await auth.resetPassword(request.portalUser!.id, targetId, parsed.data.password);
      await analytics.audit(request.portalUser!.email, "team_password_reset", { targetId });
      return reply.code(204).send();
    } catch (error) {
      return reply.code(403).send({ error: error instanceof Error ? error.message : "Password reset failed." });
    }
  });
}
