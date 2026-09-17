import { AMM_STYLE_PROMPT } from "../prompts/ammStyle.js";
import { ZACS_EDIT_PROMPT } from "../prompts/zacEdit.js";
import type { RewriteRequest } from "../schemas/rewrite.js";
import type { LanguageModel, RewriteModelResult } from "../types.js";
import type { StyleRepository } from "../repositories/StyleRepository.js";
import { AMM_SUBSTANTIVE_ADDITION_WARNING, deterministicWarnings } from "./safetyChecks.js";
import { structureRewriteContext } from "./rewriteContext.js";
import { assessAmmStyleOutput } from "./topicDrift.js";

class UnsafeAmmStyleOutputError extends Error {
  readonly code = "TOPIC_DRIFT";
  constructor() { super("AMM Style output failed grounding checks."); }
}

export class RewriteService {
  constructor(private readonly repository: StyleRepository, private readonly model: LanguageModel) {}

  async rewrite(request: RewriteRequest, requestId: string): Promise<RewriteModelResult> {
    const sources = structureRewriteContext(request);
    const context = await this.repository.getContext({
      subject: request.subject,
      draft: request.draft,
      thread: request.thread,
      limit: 3
    });
    const isAmmStyle = request.mode === "amm_style";
    const payload = {
      editingContract: isAmmStyle
        ? "Polish the current draft without adding substantive information. Other context may prevent mistakes but may not expand the draft."
        : "Identify meaningful omissions, but add content only when grounded in the current draft, current thread, or current approved business rules.",
      generationMode: isAmmStyle && !sources.currentDraft ? "reply_from_latest_inbound" : "rewrite_current_draft",
      priority: isAmmStyle
        ? ["current_draft", "latest_inbound", "current_business_rules", "recent_relevant_thread", "older_history_background_only"]
        : ["latest_inbound", "recent_relevant_thread", "current_business_rules", "current_draft", "older_history"],
      email: sources,
      styleContext: {
        voiceProfile: context.voiceProfile,
        communicationPrinciples: context.principles,
        currentBusinessRules: context.businessRules,
        approvedExamplesForStyleOnly: context.examples
      }
    };
    const generate = (instructions: string, modelPayload: unknown) => this.model.generateRewrite({
      instructions,
      requestId,
      payload: modelPayload
    });
    let result = await generate(request.mode === "amm_style" ? AMM_STYLE_PROMPT : ZACS_EDIT_PROMPT, payload);
    let guardrail: RewriteModelResult["guardrail"];

    if (isAmmStyle) {
      let assessment = assessAmmStyleOutput({
        draft: sources.currentDraft,
        latestInbound: sources.latestInbound,
        approvedBusinessKnowledge: context.businessRules,
        output: result.rewrittenText
      });
      if (assessment.codes.length) {
        const firstFailureCategories = assessment.codes;
        result = await generate(`${AMM_STYLE_PROMPT}\n\nCORRECTION REQUIRED: The first candidate failed grounding checks. Return a new revision confined to ALLOWED TOPICS. Remove unsupported facts and unrelated thread topics.`, {
          ...payload,
          rejectedCandidate: result.rewrittenText,
          rejectionCategories: assessment.codes
        });
        assessment = assessAmmStyleOutput({
          draft: sources.currentDraft,
          latestInbound: sources.latestInbound,
          approvedBusinessKnowledge: context.businessRules,
          output: result.rewrittenText
        });
        if (assessment.codes.length) {
          if (!sources.currentDraft) throw new UnsafeAmmStyleOutputError();
          return {
            rewrittenText: sources.currentDraft,
            reviewNotes: [],
            warnings: [...new Set([AMM_SUBSTANTIVE_ADDITION_WARNING, ...assessment.warnings])].slice(0, 6),
            guardrail: { regenerated: true, blocked: true, categories: [...new Set([...firstFailureCategories, ...assessment.codes])] }
          };
        }
        guardrail = { regenerated: true, blocked: false, categories: firstFailureCategories };
      }
    }

    const source = isAmmStyle
      ? `${sources.currentDraft}\n${sources.latestInbound}\n${JSON.stringify(context.businessRules)}`
      : `${request.subject}\n${request.thread}\n${request.draft}\n${JSON.stringify(context.businessRules)}`;
    const warnings = deterministicWarnings({ source, output: result.rewrittenText, draftLength: request.draft.length });
    if (isAmmStyle && warnings.some((warning) => /unsupported (?:date|money|duration|url|commitment)/i.test(warning))) {
      warnings.push(AMM_SUBSTANTIVE_ADDITION_WARNING);
    }
    return {
      ...result,
      reviewNotes: isAmmStyle ? [] : result.reviewNotes,
      warnings: [...new Set([...result.warnings, ...warnings])],
      ...(guardrail ? { guardrail } : {})
    };
  }
}
