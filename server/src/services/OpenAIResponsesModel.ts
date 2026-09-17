import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { rewriteModelResultSchema } from "../schemas/rewrite.js";
import { trainingAnalysisSchema } from "../schemas/training.js";
import type { LanguageModel, RewriteModelResult } from "../types.js";

export class OpenAIResponsesModel implements LanguageModel {
  private readonly client: OpenAI;

  constructor(apiKey: string, private readonly model: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateRewrite(input: { instructions: string; payload: unknown; requestId: string }): Promise<RewriteModelResult> {
    const response = await this.client.responses.parse({
      model: this.model,
      store: false,
      instructions: input.instructions,
      input: JSON.stringify(input.payload),
      text: { format: zodTextFormat(rewriteModelResultSchema, "rewrite_result") },
      metadata: { request_id: input.requestId, application: "amm-voice" }
    });
    if (!response.output_parsed) throw new Error("The model did not return a valid rewrite result.");
    const usage = response.usage ? {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.total_tokens
    } : undefined;
    return {
      ...response.output_parsed,
      ...(usage ? { usage } : {})
    };
  }

  async analyzeTrainingPair(input: { instructions: string; payload: unknown }): Promise<unknown> {
    const response = await this.client.responses.parse({
      model: this.model,
      store: false,
      instructions: input.instructions,
      input: JSON.stringify(input.payload),
      text: { format: zodTextFormat(trainingAnalysisSchema, "training_analysis") }
    });
    if (!response.output_parsed) throw new Error("The model did not return a valid training analysis.");
    return response.output_parsed;
  }
}
