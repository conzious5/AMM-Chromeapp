import { deterministicWarnings } from "./safetyChecks.js";

const TOPICS: Record<string, RegExp> = {
  APPAREL: /\b(?:apparel|merch(?:andise)?|shirts?|t-?shirts?|hats?|hoodies?|clothing)\b/i,
  SHIPPING: /\b(?:ship|ships|shipped|shipping|postage|mailing|delivery address)\b/i,
  ORDER: /\b(?:order|orders|ordering|quantit(?:y|ies)|sizes?)\b/i,
  PAYMENT: /\b(?:invoice|invoices|paid|payment|balance|deposit|refund)\b/i,
  TIMELINE: /\b(?:deadline|timeline|turnaround|due date|next (?:day|week|month)|this (?:week|month))\b/i,
  DELIVERABLE: /\b(?:deliverable|gallery|teaser|film|video|footage|photos?|album)\b/i,
  SERVICE: /\b(?:package|coverage|add-?on|service|session)\b/i,
  POLICY: /\b(?:policy|contract|cancellation|reschedul(?:e|ing)|late fee)\b/i
};

export interface TopicDriftAssessment {
  codes: string[];
  warnings: string[];
}

function topics(text: string): Set<string> {
  return new Set(Object.entries(TOPICS).filter(([, pattern]) => pattern.test(text)).map(([name]) => name));
}

export function assessAmmStyleOutput(input: {
  draft: string;
  latestInbound: string;
  approvedBusinessKnowledge: unknown;
  output: string;
}): TopicDriftAssessment {
  const allowedTopics = topics(`${input.draft}\n${input.latestInbound}`);
  const outputTopics = topics(input.output);
  const codes = [...outputTopics].filter((topic) => !allowedTopics.has(topic)).map((topic) => `TOPIC_DRIFT:${topic}`);
  const provenance = `${input.draft}\n${input.latestInbound}\n${JSON.stringify(input.approvedBusinessKnowledge)}`;
  const warnings = deterministicWarnings({ source: provenance, output: input.output, draftLength: input.draft.length });
  if (warnings.some((warning) => /unsupported (?:date|money|duration|url|commitment)/i.test(warning))) {
    codes.push("UNSUPPORTED_FACT");
  }
  return { codes: [...new Set(codes)], warnings };
}
