import { describe, expect, it } from "vitest";
import { rewriteRequestSchema } from "../src/schemas/rewrite.js";
import { bootstrapConfiguredUsers, hashPassword, normalizeEmail, verifyPassword, type NativeAuthService } from "../src/services/nativeAuth.js";

describe("identity and sender context", () => {
  it("keeps authenticated identity out of the client-controlled rewrite body", () => {
    const result = rewriteRequestSchema.safeParse({
      mode: "amm_style", draft: "Hello", subject: "", thread: "",
      authenticatedUser: "someone@example.com", senderAddress: "hello@authentic-moments.com"
    });
    expect(result.success).toBe(false);
  });

  it("accepts sender, recipient, and conversation context separately", () => {
    const result = rewriteRequestSchema.parse({
      mode: "zacs_edit", draft: "Hello", subject: "Question", thread: "Context",
      senderAddress: "hello@authentic-moments.com",
      recipientAddress: "client@example.com",
      conversationId: "gmail-thread-123"
    });
    expect(result.senderAddress).toBe("hello@authentic-moments.com");
  });

  it("normalizes login emails and verifies Argon2id password hashes", async () => {
    const password = "a-long-private-password";
    const hash = await hashPassword(password);
    expect(normalizeEmail("  Cylina@Authentic-Moments.com ")).toBe("cylina@authentic-moments.com");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, password)).toBe(true);
    expect(await verifyPassword(hash, "not-the-password")).toBe(false);
  });

  it("bootstraps canonical users without turning the shared sender into a user", async () => {
    const inputs: Array<{ email: string; role: string; senderAddresses: string[] }> = [];
    const auth = { bootstrapUser: async (input: { email: string; role: string; senderAddresses: string[] }) => { inputs.push(input); return true; } } as unknown as NativeAuthService;
    const created = await bootstrapConfiguredUsers(auth, { adminPassword: "admin-password-value", teamPassword: "team-password-value" });
    expect(created).toEqual(["admin@authentic-moments.com", "cylina@authentic-moments.com"]);
    expect(inputs).toMatchObject([
      { email: "admin@authentic-moments.com", role: "ADMIN", senderAddresses: ["admin@authentic-moments.com"] },
      { email: "cylina@authentic-moments.com", role: "TEAM", senderAddresses: ["cylina@authentic-moments.com", "hello@authentic-moments.com"] }
    ]);
    expect(inputs.some((input) => input.email === "hello@authentic-moments.com")).toBe(false);
  });
});
