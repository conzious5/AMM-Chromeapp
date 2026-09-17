import { createHmac, timingSafeEqual } from "node:crypto";

export interface AuthPrincipal { id: string; email: string; name?: string; role?: "ADMIN" | "TEAM" | "DEVELOPMENT"; }
export interface AuthService { authenticate(header: string | undefined): Promise<AuthPrincipal | null>; }

export class DevelopmentTokenAuth implements AuthService {
  constructor(private readonly expectedToken: string) {}

  async authenticate(header: string | undefined): Promise<AuthPrincipal | null> {
    const prefix = "Bearer ";
    if (!header?.startsWith(prefix)) return null;
    const supplied = Buffer.from(header.slice(prefix.length));
    const expected = Buffer.from(this.expectedToken);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    return { id: "development-user", email: "development@amm-voice.local", role: "DEVELOPMENT" };
  }
}

function signature(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function issueExtensionToken(principal: AuthPrincipal, secret: string, ttlSeconds = 60 * 60 * 8): string {
  const payload = Buffer.from(JSON.stringify({ ...principal, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export class SignedTokenAuth implements AuthService {
  constructor(private readonly secret: string) {}
  async authenticate(header: string | undefined): Promise<AuthPrincipal | null> {
    if (!header?.startsWith("Bearer ")) return null;
    const [payload, supplied] = header.slice(7).split(".");
    if (!payload || !supplied) return null;
    const expected = signature(payload, this.secret);
    const a = Buffer.from(supplied); const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    try {
      const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthPrincipal & { exp: number };
      if (!value.id || !value.email || !value.exp || value.exp <= Math.floor(Date.now() / 1000)) return null;
      const principal: AuthPrincipal = { id: value.id, email: value.email };
      if (value.name) principal.name = value.name;
      if (value.role) principal.role = value.role;
      return principal;
    } catch { return null; }
  }
}

export class CompositeAuth implements AuthService {
  constructor(private readonly services: AuthService[]) {}
  async authenticate(header: string | undefined): Promise<AuthPrincipal | null> {
    for (const service of this.services) {
      const principal = await service.authenticate(header);
      if (principal) return principal;
    }
    return null;
  }
}
