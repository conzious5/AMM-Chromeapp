import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import { anonymize, stripQuotedAndSignature } from "./privacy.js";
import { classifyCandidate } from "./filter.js";

interface Message { id: string; subject: string; date: Date; from: string[]; to: string[]; text: string; }

function addresses(value?: AddressObject | AddressObject[]): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.flatMap((item) => item.value.map((address) => address.address?.toLowerCase()).filter((address): address is string => Boolean(address)));
}

function normalizeSubject(subject: string): string {
  return subject.replace(/^\s*(?:re|fw|fwd):\s*/gi, "").trim().toLowerCase();
}

function splitMbox(raw: string): string[] {
  return raw.split(/\n(?=From .+\s(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s)/g).filter(Boolean);
}

async function parseMessage(raw: string, index: number): Promise<Message | null> {
  const parsed: ParsedMail = await simpleParser(raw);
  if (!parsed.date || !parsed.text) return null;
  return { id: parsed.messageId ?? `message-${index}`, subject: parsed.subject ?? "", date: parsed.date, from: addresses(parsed.from), to: addresses(parsed.to), text: parsed.text };
}

function argValues(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]!);
  return values;
}

const inputPath = argValues("--input")[0];
const senders = new Set(argValues("--sender").map((value) => value.toLowerCase()));
if (!inputPath || senders.size === 0) throw new Error("Usage: --input /path/mail.mbox --sender address [--sender address]");

let raw = "";
for await (const chunk of createReadStream(inputPath, { encoding: "utf8" })) raw += chunk;
const parsed = (await Promise.all(splitMbox(raw).map(parseMessage))).filter((message): message is Message => Boolean(message)).sort((a, b) => a.date.getTime() - b.date.getTime());
const pairs: unknown[] = [];
const excluded: unknown[] = [];

for (let index = 0; index < parsed.length; index += 1) {
  const response = parsed[index]!;
  if (!response.from.some((address) => senders.has(address))) continue;
  const responseText = stripQuotedAndSignature(response.text);
  const filter = classifyCandidate(responseText, response.subject);
  if (!filter.include) { excluded.push({ id: response.id, reason: filter.reason }); continue; }
  const subject = normalizeSubject(response.subject);
  const client = parsed.slice(0, index).reverse().find((candidate) =>
    normalizeSubject(candidate.subject) === subject &&
    !candidate.from.some((address) => senders.has(address)) &&
    candidate.date <= response.date
  );
  if (!client) { excluded.push({ id: response.id, reason: "no-prior-client-message" }); continue; }
  pairs.push({
    id: response.id,
    occurredAt: response.date.toISOString(),
    subject: anonymize(response.subject),
    clientMessage: anonymize(stripQuotedAndSignature(client.text)),
    zacResponse: anonymize(responseText),
    status: "needs-human-review"
  });
}

const outputDirectory = path.resolve("data/analysis-output");
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "candidate-pairs.json"), JSON.stringify(pairs, null, 2));
await writeFile(path.join(outputDirectory, "excluded-summary.json"), JSON.stringify(excluded, null, 2));
console.log(JSON.stringify({ parsed: parsed.length, candidatePairs: pairs.length, excluded: excluded.length, outputDirectory }));
