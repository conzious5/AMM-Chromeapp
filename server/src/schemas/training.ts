import { z } from "zod";

export const trainingAnalysisSchema = z.object({
  situation: z.string(),
  explicitClientQuestions: z.array(z.string()),
  emotionalState: z.array(z.enum([
    "excited", "curious", "concerned", "confused", "frustrated",
    "disappointed", "appreciative", "neutral", "anxious"
  ])),
  reasonableUnderlyingConcerns: z.array(z.string()),
  responseStrategy: z.array(z.string()),
  positiveFraming: z.array(z.string()),
  proactiveInformation: z.array(z.string()),
  expectationManagement: z.array(z.string()),
  anticipatedProblems: z.array(z.string()),
  tone: z.array(z.string()),
  structure: z.array(z.string()),
  reusablePrinciple: z.string(),
  doNotLearn: z.array(z.string()),
  trainingUsefulness: z.enum(["strong", "normal", "weak", "exclude"]),
  usefulnessReason: z.string()
}).strict();

export type TrainingAnalysis = z.infer<typeof trainingAnalysisSchema>;
