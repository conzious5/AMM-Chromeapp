import { timingSafeEqual } from "node:crypto";

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
