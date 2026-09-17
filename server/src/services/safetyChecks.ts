const HIGH_RISK_PATTERNS: Array<[string, RegExp]> = [
  ["date", /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}\b/gi],
  ["money", /\$\s?\d[\d,]*(?:\.\d{2})?/g],
  ["duration", /\b\d+\s+(?:business\s+)?(?:days?|weeks?|months?|hours?)\b/gi],
  ["url", /https?:\/\/\S+/gi]
];

export const AMM_SUBSTANTIVE_ADDITION_WARNING = "This suggestion may have added information not present in your draft. Review carefully.";

function matches(text: string, pattern: RegExp): Set<string> {
  return new Set(Array.from(text.matchAll(pattern), (match) => match[0].toLowerCase()));
}

export function deterministicWarnings(input: { source: string; output: string; draftLength: number }): string[] {
  const warnings: string[] = [];
  for (const [label, pattern] of HIGH_RISK_PATTERNS) {
    const sourceValues = matches(input.source, pattern);
    const outputValues = matches(input.output, pattern);
    const novel = [...outputValues].filter((value) => !sourceValues.has(value));
    if (novel.length) warnings.push(`Review possible unsupported ${label}: ${novel.join(", ")}`);
  }
  if (/\b(?:will|guarantee(?:d)?|definitely)\b/i.test(input.output) && !/\b(?:will|guarantee(?:d)?|definitely)\b/i.test(input.source)) {
    warnings.push("Review possible unsupported commitment language.");
  }
  const apologies = input.output.match(/\b(?:sorry|apologize|apologies)\b/gi)?.length ?? 0;
  if (apologies > 1) warnings.push("Review possible excessive apology.");
  if (/\b(?:per my previous email|please be advised|as per|we value your business|any inconvenience)\b/i.test(input.output)) {
    warnings.push("Review corporate or defensive phrasing.");
  }
  if (input.output.length > Math.max(input.draftLength * 2.5, input.draftLength + 800)) {
    warnings.push("Review for unnecessary length.");
  }
  return warnings;
}
