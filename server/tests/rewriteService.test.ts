import { describe, expect, it } from "vitest";
import type { StyleRepository } from "../src/repositories/StyleRepository.js";
import type { LanguageModel } from "../src/types.js";
import { RewriteService } from "../src/services/rewriteService.js";

const repository: StyleRepository = {
  async getContext() { return { voiceProfile: {}, principles: {}, businessRules: { rules: [] }, examples: [] }; }
};

describe("RewriteService", () => {
  it("suppresses review notes for AMM Style", async () => {
    const model: LanguageModel = {
      async generateRewrite() { return { rewrittenText: "Thanks for checking in!", reviewNotes: ["Trivial edit"], warnings: [] }; },
      async analyzeTrainingPair() { return {}; }
    };
    const result = await new RewriteService(repository, model).rewrite({ mode: "amm_style", draft: "checking", subject: "", thread: "" }, "request-1");
    expect(result.reviewNotes).toEqual([]);
  });

  it("flags a novel price", async () => {
    const model: LanguageModel = {
      async generateRewrite() { return { rewrittenText: "The total is $4,500.", reviewNotes: [], warnings: [] }; },
      async analyzeTrainingPair() { return {}; }
    };
    const result = await new RewriteService(repository, model).rewrite({ mode: "zacs_edit", draft: "I'll check the total.", subject: "", thread: "" }, "request-2");
    expect(result.warnings.join(" ")).toContain("unsupported money");
  });
});
