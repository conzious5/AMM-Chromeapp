import { timingSafeEqual } from "node:crypto";

export interface AuthPrincipal { id: string; }
export interface AuthService { authenticate(header: string | undefined): Promise<AuthPrincipal | null>; }

export class DevelopmentTokenAuth implements AuthService {
  constructor(private readonly expectedToken: string) {}

  async authenticate(header: string | undefined): Promise<AuthPrincipal | null> {
    const prefix = "Bearer ";
    if (!header?.startsWith(prefix)) return null;
    const supplied = Buffer.from(header.slice(prefix.length));
    const expected = Buffer.from(this.expectedToken);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    return { id: "development-user" };
  }
}
