import type { RewriteRequest } from "../schemas/rewrite.js";

export interface StructuredRewriteContext {
  subject: string;
  currentDraft: string;
  latestInbound: string;
  recentRelevantThread: string;
  olderHistory: string;
}

const headings: Record<string, keyof Omit<StructuredRewriteContext, "subject">> = {
  "current draft": "currentDraft",
  "latest inbound": "latestInbound",
  "latest relevant client message": "latestInbound",
  "recent relevant thread": "recentRelevantThread",
  "recent outgoing message": "recentRelevantThread",
  "older history": "olderHistory",
  "older thread context": "olderHistory"
};

function normalizedHeading(line: string): string {
  return line.trim().replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "").replace(/:$/, "").trim().toLowerCase();
}

function labeledSections(thread: string): Partial<StructuredRewriteContext> | undefined {
  const sections: Partial<Record<keyof Omit<StructuredRewriteContext, "subject">, string[]>> = {};
  let active: keyof Omit<StructuredRewriteContext, "subject"> | undefined;
  let found = false;
  for (const line of thread.split(/\r?\n/)) {
    const heading = headings[normalizedHeading(line)];
    if (heading) {
      active = heading;
      sections[active] ??= [];
      found = true;
    } else if (active) {
      sections[active]?.push(line);
    }
  }
  if (!found) return undefined;
  return Object.fromEntries(Object.entries(sections).map(([key, lines]) => [key, lines.join("\n").trim()]));
}

export function structureRewriteContext(request: RewriteRequest): StructuredRewriteContext {
  const labeled = labeledSections(request.thread);
  if (labeled) {
    return {
      subject: request.subject,
      currentDraft: request.draft || labeled.currentDraft || "",
      latestInbound: labeled.latestInbound || "",
      recentRelevantThread: labeled.recentRelevantThread || "",
      olderHistory: labeled.olderHistory || ""
    };
  }

  const messages = request.thread.split(/\n\s*---+\s*\n/).map((value) => value.trim()).filter(Boolean);
  return {
    subject: request.subject,
    currentDraft: request.draft,
    latestInbound: messages.at(-1) || "",
    recentRelevantThread: messages.slice(Math.max(0, messages.length - 3), -1).join("\n\n---\n\n"),
    olderHistory: messages.slice(0, Math.max(0, messages.length - 3)).join("\n\n---\n\n")
  };
}
