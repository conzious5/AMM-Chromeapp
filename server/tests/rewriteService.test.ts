import { describe, expect, it } from "vitest";
import type { StyleRepository } from "../src/repositories/StyleRepository.js";
import type { LanguageModel } from "../src/types.js";
import { RewriteService } from "../src/services/rewriteService.js";
import { AMM_STYLE_PROMPT } from "../src/prompts/ammStyle.js";
import { ZACS_EDIT_PROMPT } from "../src/prompts/zacEdit.js";
import { rewriteRequestSchema } from "../src/schemas/rewrite.js";
import { structureRewriteContext } from "../src/services/rewriteContext.js";

const repository: StyleRepository = {
  async getContext() { return { voiceProfile: {}, principles: {}, businessRules: { rules: [] }, examples: [] }; }
};

describe("RewriteService", () => {
  it("suppresses review notes for AMM Style", async () => {
    let captured: Parameters<LanguageModel["generateRewrite"]>[0] | undefined;
    const model: LanguageModel = {
      async generateRewrite(input) { captured = input; return { rewrittenText: "Thanks for checking in!", reviewNotes: ["Trivial edit"], warnings: [] }; },
      async analyzeTrainingPair() { return {}; }
    };
    const result = await new RewriteService(repository, model).rewrite({ mode: "amm_style", draft: "checking", subject: "", thread: "" }, "request-1");
    expect(result.reviewNotes).toEqual([]);
    expect(captured?.instructions).toBe(AMM_STYLE_PROMPT);
    expect(captured?.instructions).toContain("polish what the sender wrote");
    expect(captured?.instructions).toContain("OLDER HISTORY");
    expect(captured?.payload).toMatchObject({
      editingContract: expect.stringContaining("without adding substantive information"),
      generationMode: "rewrite_current_draft",
      priority: ["current_draft", "latest_inbound", "current_business_rules", "recent_relevant_thread", "older_history_background_only"]
    });
  });

  it("flags a novel price", async () => {
    const model: LanguageModel = {
      async generateRewrite() { return { rewrittenText: "The total is $4,500.", reviewNotes: [], warnings: [] }; },
      async analyzeTrainingPair() { return {}; }
    };
    const result = await new RewriteService(repository, model).rewrite({ mode: "zacs_edit", draft: "I'll check the total.", subject: "", thread: "" }, "request-2");
    expect(result.warnings.join(" ")).toContain("unsupported money");
  });

  it("gives Zac's Edit the grounded-omission contract", async () => {
    let captured: Parameters<LanguageModel["generateRewrite"]>[0] | undefined;
    const model: LanguageModel = {
      async generateRewrite(input) { captured = input; return { rewrittenText: "I will confirm tomorrow.", reviewNotes: ["Added the grounded next step."], warnings: [] }; },
      async analyzeTrainingPair() { return {}; }
    };

    await new RewriteService(repository, model).rewrite({ mode: "zacs_edit", draft: "I will confirm.", subject: "", thread: "The client asked when." }, "request-3");

    expect(captured?.instructions).toBe(ZACS_EDIT_PROMPT);
    expect(captured?.instructions).toContain("think about what the sender may have missed");
    expect(captured?.payload).toMatchObject({
      editingContract: expect.stringContaining("grounded in the current draft, current thread, or current approved business rules"),
      priority: ["latest_inbound", "recent_relevant_thread", "current_business_rules", "current_draft", "older_history"]
    });
  });

  it("treats facts copied from thread but absent from the draft as unsupported in AMM Style", async () => {
    const model: LanguageModel = {
      async generateRewrite() { return { rewrittenText: "The remaining balance is $4,500.", reviewNotes: [], warnings: [] }; },
      async analyzeTrainingPair() { return {}; }
    };

    const result = await new RewriteService(repository, model).rewrite({
      mode: "amm_style",
      draft: "Thanks for checking in. I will follow up soon.",
      subject: "Balance",
      thread: "**Older history**\nAn older message mentioned $4,500."
    }, "request-4");

    expect(result.warnings).toContain("Review possible unsupported money: $4,500");
    expect(result.warnings).toContain("This suggestion may have added information not present in your draft. Review carefully.");
    expect(result.rewrittenText).toBe("Thanks for checking in. I will follow up soon.");
    expect(result.guardrail).toMatchObject({ regenerated: true, blocked: true });
  });

  it("rejects apparel drift and regenerates a payment-only AMM Style response", async () => {
    const outputs = [
      "Thanks, Tyler! I paid the August invoice. Shirts are $25, hats are $20, and I can ship the apparel order tomorrow.",
      "Thanks, Tyler! I just paid the August invoice."
    ];
    const calls: Array<Parameters<LanguageModel["generateRewrite"]>[0]> = [];
    const model: LanguageModel = {
      async generateRewrite(input) { calls.push(input); return { rewrittenText: outputs[calls.length - 1], reviewNotes: [], warnings: [] }; },
      async analyzeTrainingPair() { return {}; }
    };

    const result = await new RewriteService(repository, model).rewrite({
      mode: "amm_style",
      subject: "August invoice",
      draft: "Thanks Tyler! I just paid the August invoice.",
      thread: [
        "We discussed shirts, hats, holiday gifts, pricing, shipping, and apparel quantities.",
        "---",
        "Tyler: Please let me know when the August invoice is paid."
      ].join("\n")
    }, "request-apparel-regression");

    expect(calls).toHaveLength(2);
    expect(calls[1].instructions).toContain("CORRECTION REQUIRED");
    expect(calls[1].payload).toMatchObject({ rejectionCategories: expect.arrayContaining(["TOPIC_DRIFT:APPAREL", "TOPIC_DRIFT:SHIPPING", "TOPIC_DRIFT:ORDER"]) });
    expect(result.rewrittenText).toBe("Thanks, Tyler! I just paid the August invoice.");
    expect(result.rewrittenText.toLowerCase()).not.toMatch(/shirt|hat|ship|apparel|order|\$25|\$20/);
    expect(result.guardrail).toEqual({
      regenerated: true,
      blocked: false,
      categories: expect.arrayContaining(["TOPIC_DRIFT:APPAREL", "TOPIC_DRIFT:SHIPPING", "TOPIC_DRIFT:ORDER"])
    });
  });

  it("keeps separate unanswered older topics in Zac's Edit review notes instead of merging them", async () => {
    let calls = 0;
    const model: LanguageModel = {
      async generateRewrite() {
        calls += 1;
        return {
          rewrittenText: "Thanks, Tyler! I just paid the August invoice.",
          reviewNotes: ["Potential additional apparel topic detected in the thread; confirm relevance before addressing it."],
          warnings: []
        };
      },
      async analyzeTrainingPair() { return {}; }
    };

    const result = await new RewriteService(repository, model).rewrite({
      mode: "zacs_edit",
      subject: "August invoice",
      draft: "Thanks Tyler! I just paid the August invoice.",
      thread: "Older: What shirts and hats can we order?\n---\nLatest: Was the August invoice paid?"
    }, "request-zac-separate-topic");

    expect(calls).toBe(1);
    expect(result.rewrittenText.toLowerCase()).not.toMatch(/shirt|hat|order/);
    expect(result.reviewNotes[0]).toContain("Potential additional apparel topic");
  });

  it("accepts empty AMM Style drafts as a distinct latest-inbound generation mode", async () => {
    const request = rewriteRequestSchema.parse({ mode: "amm_style", draft: "", subject: "Delivery", thread: "Client: Is my gallery ready?" });
    let captured: Parameters<LanguageModel["generateRewrite"]>[0] | undefined;
    const model: LanguageModel = {
      async generateRewrite(input) { captured = input; return { rewrittenText: "Thanks for checking in about your gallery.", reviewNotes: [], warnings: [] }; },
      async analyzeTrainingPair() { return {}; }
    };

    await new RewriteService(repository, model).rewrite(request, "request-empty-draft");
    expect(captured?.payload).toMatchObject({ generationMode: "reply_from_latest_inbound" });
  });

  it("preserves labeled context boundaries instead of passing one undifferentiated thread", () => {
    const context = structureRewriteContext({
      mode: "amm_style",
      draft: "I paid the invoice.",
      subject: "Invoice",
      thread: [
        "**Latest inbound**", "Did you pay the August invoice?",
        "**Recent relevant thread**", "We confirmed the invoice number.",
        "**Older history**", "We previously discussed shirts and hats."
      ].join("\n")
    });

    expect(context).toEqual({
      subject: "Invoice",
      currentDraft: "I paid the invoice.",
      latestInbound: "Did you pay the August invoice?",
      recentRelevantThread: "We confirmed the invoice number.",
      olderHistory: "We previously discussed shirts and hats."
    });
  });
});
