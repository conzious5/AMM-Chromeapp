import OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { rewriteResultJsonSchema } from "../src/schemas/rewrite.js";
import { trainingAnalysisJsonSchema } from "../src/schemas/training.js";
import { OpenAIResponsesModel } from "../src/services/OpenAIResponsesModel.js";
import { modelErrorLogFields } from "../src/services/modelError.js";
import { RewriteService } from "../src/services/rewriteService.js";

describe("OpenAI structured rewrite output", () => {
  it("sends an object-root JSON Schema and parses valid responses for both rewrite modes", async () => {
    const requests: Array<Record<string, any>> = [];
    const client = {
      responses: {
        create: async (request: Record<string, any>) => {
          requests.push(request);
          return {
            output_text: JSON.stringify({
              rewrittenText: request.metadata.request_id === "amm-request" ? "Warm AMM response" : "Clear Zac response",
              reviewNotes: ["Clarified the next step."],
              warnings: []
            }),
            usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
          };
        }
      }
    } as unknown as OpenAI;
    const model = new OpenAIResponsesModel("not-used", "test-model", client);
    const repository = { async getContext() { return { voiceProfile: {}, principles: {}, businessRules: {}, examples: [] }; } };
    const service = new RewriteService(repository, model);

    const amm = await service.rewrite({ mode: "amm_style", draft: "Draft", subject: "", thread: "" }, "amm-request");
    const zac = await service.rewrite({ mode: "zacs_edit", draft: "Draft", subject: "", thread: "" }, "zac-request");

    expect(amm).toMatchObject({ rewrittenText: "Warm AMM response", reviewNotes: [], warnings: [] });
    expect(zac).toMatchObject({ rewrittenText: "Clear Zac response", reviewNotes: ["Clarified the next step."], warnings: [] });
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      const format = request.text.format;
      expect(format.type).toBe("json_schema");
      expect(format.name).toBe("rewrite_result");
      expect(typeof format.schema).toBe("object");
      expect(format.schema).not.toBeNull();
      expect(format.schema.type).toBe("object");
      expect(format.schema.required).toEqual(["rewrittenText", "reviewNotes", "warnings"]);
      expect(format.schema.additionalProperties).toBe(false);
      expect(format.schema).toEqual(rewriteResultJsonSchema);
    }
    expect(amm.reviewNotes).toEqual([]);
    expect(Array.isArray(amm.warnings)).toBe(true);
    expect(Array.isArray(zac.reviewNotes)).toBe(true);
    expect(Array.isArray(zac.warnings)).toBe(true);
  });

  it("rejects malformed rewrite output with the canonical Zod schema", async () => {
    const client = {
      responses: {
        create: async () => ({
          output_text: JSON.stringify({ rewrittenText: "Text", reviewNotes: "not-an-array", warnings: [] })
        })
      }
    } as unknown as OpenAI;
    const model = new OpenAIResponsesModel("not-used", "test-model", client);

    await expect(model.generateRewrite({ instructions: "test", payload: {}, requestId: "malformed" }))
      .rejects.toMatchObject({ name: "ZodError" });
  });

  it("sends an object-root training schema and validates a valid structured response", async () => {
    const requests: Array<Record<string, any>> = [];
    const validAnalysis = {
      situation: "A client requested a delivery update.",
      explicitClientQuestions: ["When will it arrive?"],
      emotionalState: ["concerned"],
      reasonableUnderlyingConcerns: ["Schedule certainty"],
      responseStrategy: ["Answer directly"],
      positiveFraming: ["Confirm progress"],
      proactiveInformation: ["Give the next milestone"],
      expectationManagement: ["State the expected date"],
      anticipatedProblems: [],
      tone: ["calm"],
      structure: ["answer then context"],
      reusablePrinciple: "Resolve the explicit question before adding context.",
      doNotLearn: [],
      trainingUsefulness: "strong",
      usefulnessReason: "It demonstrates a reusable response pattern."
    };
    const client = {
      responses: {
        create: async (request: Record<string, any>) => {
          requests.push(request);
          return { output_text: JSON.stringify(validAnalysis) };
        }
      }
    } as unknown as OpenAI;
    const model = new OpenAIResponsesModel("not-used", "test-model", client);

    await expect(model.analyzeTrainingPair({ instructions: "test", payload: {} })).resolves.toEqual(validAnalysis);
    const format = requests[0].text.format;
    expect(format.name).toBe("training_analysis");
    expect(typeof format.schema).toBe("object");
    expect(format.schema).not.toBeNull();
    expect(format.schema.type).toBe("object");
    expect(format.schema.additionalProperties).toBe(false);
    expect(format.schema.required).toEqual(Object.keys(trainingAnalysisJsonSchema.properties));
    expect(format.schema).toEqual(trainingAnalysisJsonSchema);
  });

  it("rejects malformed training output with the canonical Zod schema", async () => {
    const client = {
      responses: {
        create: async () => ({
          output_text: JSON.stringify({ situation: "Incomplete", emotionalState: "concerned" })
        })
      }
    } as unknown as OpenAI;
    const model = new OpenAIResponsesModel("not-used", "test-model", client);

    await expect(model.analyzeTrainingPair({ instructions: "test", payload: {} }))
      .rejects.toMatchObject({ name: "ZodError" });
  });

  it("retains safe upstream classification fields without logging error messages", () => {
    const fields = modelErrorLogFields({
      status: 400,
      code: "invalid_json_schema",
      type: "invalid_request_error",
      param: "text.format.schema",
      requestID: "upstream-request-id",
      message: "sensitive request details"
    });
    expect(fields).toEqual({
      failure: "upstream_model_request_failed",
      upstreamStatus: 400,
      upstreamCode: "invalid_json_schema",
      upstreamType: "invalid_request_error",
      upstreamParam: "text.format.schema",
      upstreamRequestId: "upstream-request-id"
    });
    expect(JSON.stringify(fields)).not.toContain("sensitive request details");
  });
});
