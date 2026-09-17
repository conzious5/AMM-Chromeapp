import { z } from "zod";
import type { ResponseFormatTextJSONSchemaConfig } from "openai/resources/responses/responses";

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

const stringArraySchema = { type: "array", items: { type: "string" } } as const;

export const trainingAnalysisJsonSchema = {
  type: "object",
  properties: {
    situation: { type: "string" },
    explicitClientQuestions: stringArraySchema,
    emotionalState: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "excited", "curious", "concerned", "confused", "frustrated",
          "disappointed", "appreciative", "neutral", "anxious"
        ]
      }
    },
    reasonableUnderlyingConcerns: stringArraySchema,
    responseStrategy: stringArraySchema,
    positiveFraming: stringArraySchema,
    proactiveInformation: stringArraySchema,
    expectationManagement: stringArraySchema,
    anticipatedProblems: stringArraySchema,
    tone: stringArraySchema,
    structure: stringArraySchema,
    reusablePrinciple: { type: "string" },
    doNotLearn: stringArraySchema,
    trainingUsefulness: { type: "string", enum: ["strong", "normal", "weak", "exclude"] },
    usefulnessReason: { type: "string" }
  },
  required: [
    "situation", "explicitClientQuestions", "emotionalState", "reasonableUnderlyingConcerns",
    "responseStrategy", "positiveFraming", "proactiveInformation", "expectationManagement",
    "anticipatedProblems", "tone", "structure", "reusablePrinciple", "doNotLearn",
    "trainingUsefulness", "usefulnessReason"
  ],
  additionalProperties: false
} as const satisfies ResponseFormatTextJSONSchemaConfig["schema"];

export const trainingAnalysisTextFormat = {
  type: "json_schema",
  name: "training_analysis",
  strict: true,
  schema: trainingAnalysisJsonSchema
} as const satisfies ResponseFormatTextJSONSchemaConfig;
