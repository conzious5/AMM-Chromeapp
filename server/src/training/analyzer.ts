import { TRAINING_ANALYZER_PROMPT } from "../prompts/trainingAnalyzer.js";
import { trainingAnalysisSchema, type TrainingAnalysis } from "../schemas/training.js";
import type { LanguageModel } from "../types.js";

export class TrainingAnalyzer {
  constructor(private readonly model: LanguageModel) {}

  async analyze(pair: { clientMessage: string; zacResponse: string }): Promise<TrainingAnalysis> {
    const result = await this.model.analyzeTrainingPair({ instructions: TRAINING_ANALYZER_PROMPT, payload: pair });
    return trainingAnalysisSchema.parse(result);
  }
}
