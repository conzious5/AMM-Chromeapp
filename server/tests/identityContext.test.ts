import { describe, expect, it } from "vitest";
import { rewriteRequestSchema } from "../src/schemas/rewrite.js";
import { issueExtensionToken, SignedTokenAuth } from "../src/services/auth.js";

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

  it("derives the human user from a signed authentication token", async () => {
    const secret = "a-development-secret-that-is-at-least-32-characters";
    const token = issueExtensionToken({ id: "google-subject", email: "cylina@authentic-moments.com", name: "Cylina", role: "TEAM" }, secret);
    const principal = await new SignedTokenAuth(secret).authenticate(`Bearer ${token}`);
    expect(principal?.email).toBe("cylina@authentic-moments.com");
    expect(principal?.id).toBe("google-subject");
  });
});
