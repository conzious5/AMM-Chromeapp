import oauthPlugin from "@fastify/oauth2";
import cookie from "@fastify/cookie";
import secureSession from "@fastify/secure-session";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";
import type { AnalyticsRepository } from "./analyticsRepository.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { issueExtensionToken } from "./auth.js";

export interface PortalUser { email: string; name: string; role: "ADMIN" | "TEAM"; }

declare module "@fastify/secure-session" {
  interface SessionData { user?: PortalUser; }
}

function emailSet(value: string): Set<string> {
  return new Set(value.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function signState(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function issueState(redirectUri: string, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ redirectUri, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
  return `${payload}.${signState(payload, secret)}`;
}

function readState(state: string, secret: string): { redirectUri: string } | null {
  const [payload, supplied] = state.split(".");
  if (!payload || !supplied) return null;
  const expected = signState(payload, secret); const a = Buffer.from(supplied); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { redirectUri: string; exp: number };
    return value.exp > Math.floor(Date.now() / 1000) ? { redirectUri: value.redirectUri } : null;
  } catch { return null; }
}

function allowedExtensionRedirect(uri: string, configuredIds: Set<string>, production: boolean): boolean {
  const match = /^https:\/\/([a-p]{32})\.chromiumapp\.org\/callback$/.exec(uri);
  if (!match?.[1]) return false;
  return configuredIds.has(match[1]) || (!production && configuredIds.size === 0);
}

export async function registerPortalAuth(app: FastifyInstance, config: AppConfig, analytics: AnalyticsRepository): Promise<void> {
  await app.register(cookie);
  await app.register(secureSession, {
    secret: config.SESSION_SECRET,
    salt: "amm-voice-portal",
    cookie: { path: "/", httpOnly: true, sameSite: "lax", secure: config.NODE_ENV === "production", maxAge: 60 * 60 * 8 }
  });
  const admins = emailSet(config.ADMIN_EMAILS);
  const team = emailSet(config.TEAM_EMAILS);
  const oauthReady = Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
  const extensionIds = emailSet(config.EXTENSION_IDS);

  if (oauthReady) {
    await app.register(oauthPlugin, {
      name: "googleOAuth2",
      scope: ["openid", "email", "profile"],
      credentials: {
        client: { id: config.GOOGLE_CLIENT_ID!, secret: config.GOOGLE_CLIENT_SECRET! },
        auth: {
          tokenHost: "https://oauth2.googleapis.com",
          tokenPath: "/token",
          authorizeHost: "https://accounts.google.com",
          authorizePath: "/o/oauth2/v2/auth"
        }
      },
      startRedirectPath: "/auth/google",
      callbackUri: `${config.PUBLIC_BASE_URL}/auth/google/callback`
    });
    app.get("/auth/google/callback", async function (request, reply) {
      const oauth = this as FastifyInstance & { googleOAuth2: { getAccessTokenFromAuthorizationCodeFlow(request: FastifyRequest): Promise<{ token: { access_token: string } }> } };
      const token = await oauth.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
      const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token.token.access_token}` } });
      if (!response.ok) return reply.code(401).send("Google sign-in failed.");
      const profile = await response.json() as { email?: string; email_verified?: boolean; name?: string };
      const email = profile.email?.toLowerCase();
      if (!email || profile.email_verified !== true || (!admins.has(email) && !team.has(email))) {
        if (email) await analytics.audit(email, "login_denied");
        return reply.code(403).send("This Google account is not approved for AMM Voice.");
      }
      const user: PortalUser = { email, name: profile.name ?? email, role: admins.has(email) ? "ADMIN" : "TEAM" };
      request.session.set("user", user);
      await analytics.audit(email, "login_success");
      return reply.redirect("/");
    });

    app.get("/auth/extension/start", async (request, reply) => {
      const redirectUri = (request.query as { redirect_uri?: string }).redirect_uri ?? "";
      if (!allowedExtensionRedirect(redirectUri, extensionIds, config.NODE_ENV === "production")) return reply.code(400).send("Extension redirect is not allowed.");
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", config.GOOGLE_CLIENT_ID!);
      url.searchParams.set("redirect_uri", `${config.PUBLIC_BASE_URL}/auth/extension/callback`);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", issueState(redirectUri, config.SESSION_SECRET));
      url.searchParams.set("prompt", "select_account");
      return reply.redirect(url.toString());
    });

    app.get("/auth/extension/callback", async (request, reply) => {
      const query = request.query as { code?: string; state?: string };
      const state = query.state ? readState(query.state, config.SESSION_SECRET) : null;
      if (!query.code || !state || !allowedExtensionRedirect(state.redirectUri, extensionIds, config.NODE_ENV === "production")) return reply.code(400).send("Invalid extension sign-in state.");
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code: query.code, client_id: config.GOOGLE_CLIENT_ID!, client_secret: config.GOOGLE_CLIENT_SECRET!, redirect_uri: `${config.PUBLIC_BASE_URL}/auth/extension/callback`, grant_type: "authorization_code" })
      });
      if (!tokenResponse.ok) return reply.code(401).send("Google sign-in failed.");
      const token = await tokenResponse.json() as { access_token?: string };
      if (!token.access_token) return reply.code(401).send("Google sign-in failed.");
      const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
      const profile = await profileResponse.json() as { sub?: string; email?: string; email_verified?: boolean; name?: string };
      const email = profile.email?.toLowerCase();
      if (!profileResponse.ok || !profile.sub || !email || profile.email_verified !== true || (!admins.has(email) && !team.has(email))) {
        if (email) await analytics.audit(email, "extension_login_denied");
        return reply.code(403).send("This Google account is not approved for AMM Voice.");
      }
      const role = admins.has(email) ? "ADMIN" as const : "TEAM" as const;
      const extensionToken = issueExtensionToken({ id: profile.sub, email, name: profile.name ?? email, role }, config.SESSION_SECRET);
      await analytics.audit(email, "extension_login_success");
      return reply.redirect(`${state.redirectUri}#token=${encodeURIComponent(extensionToken)}`);
    });
  } else {
    app.get("/auth/google", async (_request, reply) => reply.code(503).send("Google OAuth has not been configured yet."));
    app.get("/auth/extension/start", async (_request, reply) => reply.code(503).send("Google OAuth has not been configured yet."));
  }

  app.get("/auth/me", async (request, reply) => {
    const user = request.session.get("user");
    return user ? { authenticated: true, user } : reply.code(401).send({ authenticated: false, oauthReady });
  });
  app.post("/auth/logout", async (request, reply) => {
    const user = request.session.get("user");
    if (user) await analytics.audit(user.email, "logout");
    request.session.delete();
    return reply.code(204).send();
  });
}

export async function requirePortalUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.session.get("user")) await reply.code(401).send({ error: "Authentication required" });
}
