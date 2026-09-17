import { AMM_STYLE_PROMPT } from "../prompts/ammStyle.js";
import { ZACS_EDIT_PROMPT } from "../prompts/zacEdit.js";
import type { RewriteRequest } from "../schemas/rewrite.js";
import type { LanguageModel, RewriteModelResult } from "../types.js";
import type { StyleRepository } from "../repositories/StyleRepository.js";
import { deterministicWarnings } from "./safetyChecks.js";

export class RewriteService {
  constructor(private readonly repository: StyleRepository, private readonly model: LanguageModel) {}

  async rewrite(request: RewriteRequest, requestId: string): Promise<RewriteModelResult> {
    const context = await this.repository.getContext({
      subject: request.subject,
      draft: request.draft,
      thread: request.thread,
      limit: 3
    });
    const result = await this.model.generateRewrite({
      instructions: request.mode === "amm_style" ? AMM_STYLE_PROMPT : ZACS_EDIT_PROMPT,
      requestId,
      payload: {
        priority: [
          "current_thread", "current_business_rules", "draft_intent",
          "communication_principles", "approved_examples", "general_knowledge"
        ],
        email: request,
        context
      }
    });
    const source = `${request.subject}\n${request.thread}\n${request.draft}\n${JSON.stringify(context.businessRules)}`;
    const warnings = deterministicWarnings({ source, output: result.rewrittenText, draftLength: request.draft.length });
    return { ...result, reviewNotes: request.mode === "amm_style" ? [] : result.reviewNotes, warnings: [...new Set([...result.warnings, ...warnings])] };
  }
}
