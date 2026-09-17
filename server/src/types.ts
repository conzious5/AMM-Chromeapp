export type RewriteMode = "amm_style" | "zacs_edit";

export interface ApprovedExample {
  id: string;
  category: string;
  scenario: string;
  emotionalTone: string[];
  topics: string[];
  responseGoals: string[];
  clientMessage: string;
  response: string;
  quality: "strong" | "normal";
  approvedAt: string;
}

export interface StyleContext {
  voiceProfile: unknown;
  principles: unknown;
  businessRules: unknown;
  examples: ApprovedExample[];
}

export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface RewriteModelResult {
  rewrittenText: string;
  reviewNotes: string[];
  warnings: string[];
  usage?: ModelUsage;
}

export interface LanguageModel {
  generateRewrite(input: {
    instructions: string;
    payload: unknown;
    requestId: string;
  }): Promise<RewriteModelResult>;
  analyzeTrainingPair(input: {
    instructions: string;
    payload: unknown;
  }): Promise<unknown>;
}
