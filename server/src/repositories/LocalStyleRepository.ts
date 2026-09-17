import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ApprovedExample, StyleContext } from "../types.js";
import type { StyleRepository } from "./StyleRepository.js";

const dataDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../data");
const stopWords = new Set(["the", "and", "for", "you", "your", "our", "are", "was", "with", "this", "that", "have", "from"]);

function tokens(value: string): Set<string> {
  return new Set((value.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => word.length > 2 && !stopWords.has(word)));
}

function scoreExample(example: ApprovedExample, queryTokens: Set<string>): number {
  const searchable = tokens([
    example.category, example.scenario, ...example.emotionalTone,
    ...example.topics, ...example.responseGoals, example.clientMessage
  ].join(" "));
  let overlap = 0;
  for (const token of queryTokens) if (searchable.has(token)) overlap += 1;
  const qualityBoost = example.quality === "strong" ? 2 : 0;
  return overlap + qualityBoost;
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(dataDirectory, file), "utf8"));
}

async function readJsonl(file: string): Promise<ApprovedExample[]> {
  const raw = await readFile(path.join(dataDirectory, file), "utf8");
  return raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as ApprovedExample);
}

export class LocalStyleRepository implements StyleRepository {
  async getContext(query: { subject: string; draft: string; thread: string; limit?: number }): Promise<StyleContext> {
    const [voiceProfile, principles, businessRules, examples] = await Promise.all([
      readJson("amm-voice-profile.json"),
      readJson("customer-service-principles.json"),
      readJson("current-business-rules.json"),
      readJsonl("approved-examples.jsonl")
    ]);
    const queryTokens = tokens(`${query.subject} ${query.draft} ${query.thread}`);
    const limit = Math.min(query.limit ?? 3, 5);
    const ranked = examples
      .map((example) => ({ example, score: scoreExample(example, queryTokens) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ example }) => example);
    return { voiceProfile, principles, businessRules, examples: ranked };
  }
}
