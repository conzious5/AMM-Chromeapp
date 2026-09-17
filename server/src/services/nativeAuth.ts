import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { PrismaClient, type AuthSessionType, type UserRole } from "@prisma/client";
import type { AuthPrincipal, AuthService } from "./auth.js";

const ACCESS_TTL_MS = 15 * 60 * 1000;
const EXTENSION_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PORTAL_TTL_MS = 8 * 60 * 60 * 1000;
const PORTAL_REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;

const passwordOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32
} as const;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "TEAM";
  active: boolean;
}

export interface LoginResult {
  user: PublicUser;
  accessToken: string;
  accessExpiresAt: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
}

export class AuthenticationError extends Error {
  constructor(public readonly code: "INVALID_CREDENTIALS" | "ACCOUNT_LOCKED" | "INACTIVE" | "INVALID_SESSION") {
    super(code === "ACCOUNT_LOCKED" ? "Too many sign-in attempts. Try again later." : "Invalid email or password.");
  }
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validatePassword(value: string): void {
  if (value.length < 12 || value.length > 256) throw new Error("Password must be between 12 and 256 characters.");
}

export async function hashPassword(value: string): Promise<string> {
  validatePassword(value);
  return argon2.hash(value, passwordOptions);
}

export async function verifyPassword(hash: string, value: string): Promise<boolean> {
  try { return await argon2.verify(hash, value); } catch { return false; }
}

function opaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function publicUser(user: { id: string; email: string; displayName: string; role: UserRole; active: boolean }): PublicUser {
  return { id: user.id, email: user.email, name: user.displayName, role: user.role, active: user.active };
}

export class NativeAuthService implements AuthService {
  private readonly dummyHash = hashPassword("not-a-real-password-value");

  constructor(private readonly client: PrismaClient) {}

  async login(emailInput: string, password: string, type: AuthSessionType, remember = false): Promise<LoginResult> {
    const email = normalizeEmail(emailInput);
    const user = await this.client.user.findUnique({ where: { email } });
    if (!user) {
      await verifyPassword(await this.dummyHash, password);
      throw new AuthenticationError("INVALID_CREDENTIALS");
    }
    if (!user.active) throw new AuthenticationError("INACTIVE");
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new AuthenticationError("ACCOUNT_LOCKED");
    if (!(await verifyPassword(user.passwordHash, password))) {
      const failures = user.failedLoginCount + 1;
      await this.client.user.update({ where: { id: user.id }, data: failures >= MAX_FAILED_LOGINS ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MS) } : { failedLoginCount: failures } });
      throw new AuthenticationError("INVALID_CREDENTIALS");
    }
    const accessToken = opaqueToken();
    const now = Date.now();
    const portalTtl = remember ? PORTAL_REMEMBER_TTL_MS : PORTAL_TTL_MS;
    const tokenExpiresAt = new Date(now + (type === "EXTENSION" ? ACCESS_TTL_MS : portalTtl));
    const expiresAt = new Date(now + (type === "EXTENSION" ? EXTENSION_REFRESH_TTL_MS : portalTtl));
    const refreshToken = type === "EXTENSION" ? opaqueToken() : undefined;
    await this.client.$transaction([
      this.client.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } }),
      this.client.authSession.create({ data: {
        userId: user.id, type, tokenHash: tokenHash(accessToken), tokenExpiresAt, expiresAt,
        ...(refreshToken ? { refreshTokenHash: tokenHash(refreshToken) } : {})
      } })
    ]);
    return {
      user: publicUser(user), accessToken, accessExpiresAt: tokenExpiresAt.toISOString(),
      ...(refreshToken ? { refreshToken, refreshExpiresAt: expiresAt.toISOString() } : {})
    };
  }

  private async sessionPrincipal(token: string, type: AuthSessionType): Promise<AuthPrincipal | null> {
    const session = await this.client.authSession.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
    const now = new Date();
    if (!session || session.type !== type || session.revokedAt || session.tokenExpiresAt <= now || session.expiresAt <= now || !session.user.active) return null;
    return { id: session.user.id, email: session.user.email, name: session.user.displayName, role: session.user.role };
  }

  async authenticatePortal(token: string | undefined): Promise<AuthPrincipal | null> {
    return token ? this.sessionPrincipal(token, "PORTAL") : null;
  }

  async authenticate(header: string | undefined): Promise<AuthPrincipal | null> {
    if (!header?.startsWith("Bearer ")) return null;
    return this.sessionPrincipal(header.slice(7), "EXTENSION");
  }

  async refreshExtension(refreshToken: string): Promise<LoginResult> {
    const session = await this.client.authSession.findUnique({ where: { refreshTokenHash: tokenHash(refreshToken) }, include: { user: true } });
    const now = new Date();
    if (!session || session.type !== "EXTENSION" || session.revokedAt || session.expiresAt <= now || !session.user.active) throw new AuthenticationError("INVALID_SESSION");
    const accessToken = opaqueToken();
    const replacementRefreshToken = opaqueToken();
    const tokenExpiresAt = new Date(Date.now() + ACCESS_TTL_MS);
    await this.client.authSession.update({ where: { id: session.id }, data: {
      tokenHash: tokenHash(accessToken), refreshTokenHash: tokenHash(replacementRefreshToken), tokenExpiresAt, lastUsedAt: now
    } });
    return {
      user: publicUser(session.user), accessToken, accessExpiresAt: tokenExpiresAt.toISOString(),
      refreshToken: replacementRefreshToken, refreshExpiresAt: session.expiresAt.toISOString()
    };
  }

  async revokeToken(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.client.authSession.updateMany({ where: { tokenHash: tokenHash(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeBearer(header: string | undefined): Promise<void> {
    await this.revokeToken(header?.startsWith("Bearer ") ? header.slice(7) : undefined);
  }

  async revokeAll(userId: string): Promise<void> {
    await this.client.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.client.user.findUnique({ where: { id: userId } });
    if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) throw new AuthenticationError("INVALID_CREDENTIALS");
    const passwordHash = await hashPassword(newPassword);
    await this.client.$transaction([
      this.client.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } }),
      this.client.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
    ]);
  }

  async senderAddresses(userId: string, fallbackEmail: string): Promise<string[]> {
    const values = await this.client.userSenderPermission.findMany({ where: { userId }, orderBy: { senderAddress: "asc" } });
    return values.length ? values.map((value) => value.senderAddress) : [fallbackEmail];
  }

  async listUsers(): Promise<Array<PublicUser & { senderAddresses: string[] }>> {
    const users = await this.client.user.findMany({ include: { senderPermissions: true }, orderBy: { email: "asc" } });
    return users.map((user) => ({ ...publicUser(user), senderAddresses: user.senderPermissions.map((value) => value.senderAddress) }));
  }

  async createUser(input: { email: string; displayName: string; role: "ADMIN" | "TEAM"; password: string; senderAddresses?: string[] }): Promise<PublicUser> {
    const email = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password);
    const senders = [...new Set((input.senderAddresses?.length ? input.senderAddresses : [email]).map(normalizeEmail))];
    const user = await this.client.user.create({ data: {
      email, displayName: input.displayName.trim(), role: input.role, passwordHash,
      senderPermissions: { create: senders.map((senderAddress) => ({ senderAddress })) }
    } });
    return publicUser(user);
  }

  async resetPassword(actorId: string, targetId: string, password: string): Promise<void> {
    const actor = await this.client.user.findUnique({ where: { id: actorId } });
    const target = await this.client.user.findUnique({ where: { id: targetId } });
    if (!actor || actor.role !== "ADMIN" || !target || target.role !== "TEAM") throw new Error("Not authorized to reset this password.");
    const passwordHash = await hashPassword(password);
    await this.client.$transaction([
      this.client.user.update({ where: { id: targetId }, data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } }),
      this.client.authSession.updateMany({ where: { userId: targetId, revokedAt: null }, data: { revokedAt: new Date() } })
    ]);
  }

  async bootstrapUser(input: { email: string; displayName: string; role: "ADMIN" | "TEAM"; password: string; senderAddresses: string[] }): Promise<boolean> {
    const email = normalizeEmail(input.email);
    if (await this.client.user.findUnique({ where: { email }, select: { id: true } })) return false;
    await this.createUser(input);
    return true;
  }
}

export async function bootstrapConfiguredUsers(auth: NativeAuthService, values: { adminPassword?: string; teamPassword?: string }): Promise<string[]> {
  const created: string[] = [];
  if (values.adminPassword && await auth.bootstrapUser({ email: "admin@authentic-moments.com", displayName: "AMM Administrator", role: "ADMIN", password: values.adminPassword, senderAddresses: ["admin@authentic-moments.com"] })) created.push("admin@authentic-moments.com");
  if (values.teamPassword && await auth.bootstrapUser({ email: "cylina@authentic-moments.com", displayName: "Cylina", role: "TEAM", password: values.teamPassword, senderAddresses: ["cylina@authentic-moments.com", "hello@authentic-moments.com"] })) created.push("cylina@authentic-moments.com");
  return created;
}
