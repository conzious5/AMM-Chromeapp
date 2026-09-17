import { describe, expect, it } from "vitest";
import { rewriteRequestSchema } from "../src/schemas/rewrite.js";
import { hashPassword, normalizeEmail, verifyPassword } from "../src/services/nativeAuth.js";

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
});
