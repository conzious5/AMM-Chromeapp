(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AMMVoiceCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const SETTINGS_DEFAULTS = Object.freeze({ defaultAction: "amm_style", showZacReview: true, autoDetectSender: true, backendEnvironment: "production" });
  const WARNING_MESSAGES = Object.freeze({
    UNSUPPORTED_PROMISE: "Potential promise: this wording may be firmer than the conversation supports.",
    TOPIC_DRIFT: "This suggestion may have added information not present in your draft. Review carefully.",
    UNSUPPORTED_FACT: "This suggestion may have added information not present in your draft. Review carefully.",
    UNRELATED_THREAD_CONTEXT: "This suggestion may have added information not present in your draft. Review carefully.",
    MISSING_QUESTION: "A client question may still need an answer.",
    TIMELINE_AMBIGUITY: "The timing may not be clear enough yet.",
    POSSIBLE_CONTRADICTION: "This may conflict with something stated earlier in the conversation.",
    MISSING_NEXT_STEP: "Consider clarifying what happens next and who owns it."
  });
  const STOP_WORDS = new Set(["a", "an", "and", "are", "be", "can", "do", "for", "how", "i", "is", "it", "of", "on", "or", "the", "to", "we", "what", "when", "will", "you", "your"]);
  function normalizeEmail(value) { const match = String(value || "").match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/); return match ? match[0].toLowerCase() : ""; }
  function resolveSender(detected, allowed, autoDetect = true) {
    const normalizedAllowed = [...new Set((allowed || []).map(normalizeEmail).filter(Boolean))]; const normalizedDetected = normalizeEmail(detected);
    if (autoDetect && normalizedDetected && normalizedAllowed.includes(normalizedDetected)) return { sender: normalizedDetected, options: normalizedAllowed, needsSelection: false, detected: true };
    return { sender: "", options: normalizedAllowed, needsSelection: true, detected: false };
  }
  function resolveComposeSender(detected, authenticatedUser, allowed, autoDetect = true) { return resolveSender(normalizeEmail(detected) || normalizeEmail(authenticatedUser), allowed, autoDetect); }
  function extractQuestions(text, limit = 8) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim(); if (!normalized) return [];
    const matches = normalized.match(/(?:^|(?<=[.!?]\s))[^?]{3,260}\?/g) || [];
    return [...new Set(matches.map((value) => value.trim()))].slice(-limit);
  }
  function meaningfulTokens(value) { return [...new Set(String(value || "").toLowerCase().match(/[a-z0-9']{3,}/g) || [])].filter((token) => !STOP_WORDS.has(token)); }
  function questionCoverage(questions, response) {
    const responseTokens = new Set(meaningfulTokens(response));
    return (questions || []).map((question) => { const tokens = meaningfulTokens(question); const overlap = tokens.filter((token) => responseTokens.has(token)).length; const covered = tokens.length > 0 && overlap / tokens.length >= 0.34; return { question, covered, status: covered ? "covered" : "review" }; });
  }
  function limitThread(messages, options = {}) {
    const maxMessages = options.maxMessages || 6; const maxChars = options.maxChars || 20000;
    const candidates = (messages || []).map((value) => String(value || "").trim()).filter(Boolean).slice(-maxMessages); const selected = []; let remaining = maxChars;
    for (let index = candidates.length - 1; index >= 0 && remaining > 0; index -= 1) { const message = candidates[index]; if (message.length <= remaining) { selected.unshift(message); remaining -= message.length; } else if (selected.length === 0) { selected.unshift(message.slice(-remaining)); remaining = 0; } }
    return selected.join("\n\n---\n\n");
  }
  function buildLabeledThreadContext(messages, options = {}) {
    const maxMessages = options.maxMessages || 5; const maxChars = options.maxChars || 12000;
    const ownAddresses = new Set((options.ownAddresses || []).map(normalizeEmail).filter(Boolean));
    const records = (messages || []).map((item, index) => ({ text: String(typeof item === "string" ? item : item?.text || "").trim(), senderAddress: normalizeEmail(typeof item === "string" ? "" : item?.senderAddress), index })).filter((item) => item.text);
    if (!records.length || maxMessages < 1 || maxChars < 1) return "";
    const inbound = records.filter((item) => item.senderAddress && !ownAddresses.has(item.senderAddress)); const latestInbound = inbound.at(-1) || null;
    const focusTokens = new Set(meaningfulTokens(`${options.subject || ""} ${options.draft || ""} ${latestInbound?.text || ""}`));
    const relevance = (item) => meaningfulTokens(item.text).filter((token) => focusTokens.has(token)).length;
    const remaining = records.filter((item) => item !== latestInbound); const newest = remaining.at(-1) || null;
    const recentPool = remaining.slice(-4); const recent = recentPool.filter((item) => item === newest || relevance(item) > 0).slice(-Math.max(0, maxMessages - (latestInbound ? 1 : 0)));
    const used = new Set([latestInbound, ...recent].filter(Boolean)); const olderCandidates = remaining.filter((item) => !used.has(item) && relevance(item) > 0).sort((a, b) => relevance(b) - relevance(a) || b.index - a.index);
    const older = olderCandidates.slice(0, Math.max(0, maxMessages - used.size));
    const sections = [];
    if (latestInbound) sections.push(["Latest inbound", [latestInbound]]);
    if (recent.length) sections.push(["Recent relevant thread", recent]);
    if (older.length) sections.push(["Older history", older.sort((a, b) => a.index - b.index)]);
    let output = "";
    for (const [label, items] of sections) {
      const block = `${label}:\n${items.map((item) => item.text).join("\n\n---\n\n")}`; const separator = output ? "\n\n" : ""; const available = maxChars - output.length - separator.length;
      if (available <= label.length + 2) break; output += separator + block.slice(0, available);
    }
    return output;
  }
  function warningView(warning) {
    const raw = typeof warning === "string" ? warning : warning?.code || warning?.category || warning?.message || "Review suggested"; const code = String(raw).trim().toUpperCase().replace(/[\s-]+/g, "_");
    return { code: WARNING_MESSAGES[code] ? code : "REVIEW_SUGGESTED", message: WARNING_MESSAGES[code] || String(raw) };
  }
  function classifyError(error) {
    const code = String(error?.code || ""); const value = `${code} ${String(error?.message || error || "API failure")}`;
    if (/SIGN_IN_REQUIRED/i.test(value)) return { code: "AUTH_REQUIRED", message: "Sign in to AMM Voice to continue." };
    if (/AUTHENTICATION_EXPIRED/i.test(value)) return { code: "AUTH_REQUIRED", message: "Your session expired. Sign in again, then retry." };
    if (/UNAUTHORIZED_SENDER/i.test(value)) return { code: "UNAUTHORIZED_SENDER", message: "This From address is not authorized for your AMM Voice account." };
    if (/INVALID_REQUEST/i.test(value)) return { code: "INVALID_REQUEST", message: "AMM Voice could not use this draft context. Your draft is unchanged." };
    if (/BACKEND_UNAVAILABLE/i.test(value)) return { code: "BACKEND_UNAVAILABLE", message: "AMM Voice is temporarily unavailable. Your draft is safe; please try again." };
    if (/MODEL_FAILURE|Rewrite failed/i.test(value)) return { code: "MODEL", message: "The AMM Voice model could not complete the rewrite. Your draft is unchanged." };
    if (/MALFORMED_RESPONSE|MALFORMED/i.test(value)) return { code: "MALFORMED_RESPONSE", message: "AMM Voice returned an incomplete response. Your draft is unchanged; please try again." };
    if (/NO_DRAFT/i.test(value)) return { code: "NO_DRAFT", message: "Add some draft text before requesting a rewrite." };
    if (/SENDER_REQUIRED/i.test(value)) return { code: "SENDER_REQUIRED", message: "Choose an authorized From address to continue." };
    if (/RATE_LIMIT|429/i.test(value)) return { code: "RATE_LIMIT", message: "AMM Voice is receiving several requests. Wait a moment and try again." };
    if (/TIMEOUT|timed out|AbortError/i.test(value)) return { code: "TIMEOUT", message: "The request took too long. Your draft is unchanged; please try again." };
    if (/Failed to fetch|Illegal invocation|NetworkError|Load failed|NETWORK|offline/i.test(value)) return { code: "NETWORK", message: "AMM Voice couldn't connect. Your draft is safe. Please try again." };
    if (/MODEL/i.test(value)) return { code: "MODEL", message: "The rewrite could not be completed. Your draft is unchanged; please try again." };
    return { code: "API", message: value || "AMM Voice could not complete the request. Your draft is unchanged." };
  }
  function sanitizeTelemetry(name, metadata = {}) {
    const allowedNames = new Set(["extension_opened", "amm_style_requested", "zacs_edit_requested", "rewrite_accepted", "rewrite_retried", "rewrite_undone", "warning_displayed", "email_sent_observed", "email_coaching_submission_started", "email_coaching_submission_succeeded", "email_coaching_submission_failed"]); if (!allowedNames.has(name)) return null;
    const safe = {}; for (const key of ["mode", "warningCode", "result", "senderDetected", "questionCount", "composeMode", "assistanceUsed", "reasonCode"]) if (["string", "number", "boolean"].includes(typeof metadata[key])) safe[key] = metadata[key];
    return { name, metadata: safe };
  }
  function meaningfulReviewNotes(notes) { return (notes || []).map((value) => String(value || "").trim()).filter((value) => value && !/\b(grammar|spelling|punctuation|comma|capitalization|typo)\b/i.test(value)); }
  function createComposeSession(id = "") { return { id, mode: "amm_style", busy: false, selectedSender: "", output: null, payload: null, undoSnapshot: null, coachingConfig: null, coachingSendDedup: null, assistance: { ammStyleUsed: false, zacsEditUsed: false, rewriteAccepted: false, originalDraft: "", lastSuggestion: "", acceptedText: "", warningCodes: [], questionCoverageWarningDisplayed: false } }; }
  return { SETTINGS_DEFAULTS, WARNING_MESSAGES, normalizeEmail, resolveSender, resolveComposeSender, extractQuestions, questionCoverage, limitThread, buildLabeledThreadContext, warningView, classifyError, sanitizeTelemetry, meaningfulReviewNotes, createComposeSession };
});
