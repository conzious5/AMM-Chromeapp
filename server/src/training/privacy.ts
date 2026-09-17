const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const STREET = /\b\d{1,6}\s+[A-Za-z0-9.' -]+\s(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd)\b/gi;

export function anonymize(text: string): string {
  return text
    .replace(EMAIL, "[EMAIL]")
    .replace(PHONE, "[PHONE]")
    .replace(STREET, "[ADDRESS]")
    .replace(/^(?:hi|hello|hey)\s+([A-Z][a-z]+)([,!])/im, (_match, _name, punctuation) => `Hi [CLIENT]${punctuation}`);
}

export function stripQuotedAndSignature(text: string): string {
  const withoutQuoted = text.split(/\nOn .+ wrote:\n|\nFrom:\s.+\nSent:\s/si)[0] ?? text;
  return withoutQuoted.split(/\n--\s*\n|\nBest,\s*\n|\nThanks,\s*\n|\nSincerely,\s*\n/i)[0]?.trim() ?? "";
}
