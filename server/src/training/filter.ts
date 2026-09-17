export type FilterResult = { include: boolean; reason: string };

export function classifyCandidate(text: string, subject: string): FilterResult {
  const trimmed = text.trim();
  if (trimmed.length < 40) return { include: false, reason: "too-short" };
  if (/^(?:thanks|thank you|yes|no|sounds good|perfect)[!.\s]*$/i.test(trimmed)) return { include: false, reason: "one-line-reply" };
  if (/unsubscribe|do not reply|receipt|payment received|calendar notification/i.test(`${subject}\n${trimmed}`)) return { include: false, reason: "automated-or-receipt" };
  const links = trimmed.match(/https?:\/\/\S+/g)?.length ?? 0;
  if (links > 0 && trimmed.replace(/https?:\/\/\S+/g, "").trim().length < 60) return { include: false, reason: "mostly-links" };
  return { include: true, reason: "candidate" };
}
