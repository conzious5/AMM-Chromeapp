import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { rewriteRequestSchema } from "../schemas/rewrite.js";
import { LocalStyleRepository } from "../repositories/LocalStyleRepository.js";
import { OpenAIResponsesModel } from "../services/OpenAIResponsesModel.js";
import { RewriteService } from "../services/rewriteService.js";

interface EvalCase {
  id: string;
  mode: "amm_style" | "zacs_edit";
  subject: string;
  thread: string;
  draft: string;
  assertions: { mustIncludeOneOf: string[]; mustNotInclude: string[]; maxCharacters: number; };
}

if (!config.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required to run model evaluations.");
const file = path.resolve("data/eval-tests.jsonl");
const cases = (await readFile(file, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as EvalCase);
const service = new RewriteService(new LocalStyleRepository(), new OpenAIResponsesModel(config.OPENAI_API_KEY, config.OPENAI_MODEL));
let failures = 0;
for (const testCase of cases) {
  const request = rewriteRequestSchema.parse({ ...testCase, recipientName: "Client", sender: "Cylina" });
  const result = await service.rewrite(request, `eval-${testCase.id}`);
  const lower = result.rewrittenText.toLowerCase();
  const checks = {
    includes: testCase.assertions.mustIncludeOneOf.some((value) => lower.includes(value.toLowerCase())),
    excludes: testCase.assertions.mustNotInclude.every((value) => !lower.includes(value.toLowerCase())),
    length: result.rewrittenText.length <= testCase.assertions.maxCharacters,
    deterministicWarnings: result.warnings
  };
  const passed = checks.includes && checks.excludes && checks.length && checks.deterministicWarnings.length === 0;
  if (!passed) failures += 1;
  console.log(JSON.stringify({ id: testCase.id, passed, checks, output: result.rewrittenText }));
}
if (failures) process.exitCode = 1;
