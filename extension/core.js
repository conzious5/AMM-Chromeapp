(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AMMVoiceCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const SETTINGS_DEFAULTS = Object.freeze({ defaultAction: "amm_style", showZacReview: true, autoDetectSender: true, backendEnvironment: "production" });
  const WARNING_MESSAGES = Object.freeze({
    UNSUPPORTED_PROMISE: "Potential promise: this wording may be firmer than the conversation supports.",
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
  function warningView(warning) {
    const raw = typeof warning === "string" ? warning : warning?.code || warning?.message || "Review suggested"; const code = String(raw).trim().toUpperCase().replace(/[\s-]+/g, "_");
    return { code: WARNING_MESSAGES[code] ? code : "REVIEW_SUGGESTED", message: WARNING_MESSAGES[code] || String(raw) };
  }
  function classifyError(error) {
    const value = String(error?.message || error || "API failure");
    if (/SIGN_IN_REQUIRED|AUTHENTICATION_EXPIRED/i.test(value)) return { code: "AUTH_REQUIRED", message: "Your session expired. Sign in again, then retry." };
    if (/NO_DRAFT/i.test(value)) return { code: "NO_DRAFT", message: "Add some draft text before requesting a rewrite." };
    if (/SENDER_REQUIRED/i.test(value)) return { code: "SENDER_REQUIRED", message: "Choose an authorized From address to continue." };
    if (/RATE_LIMIT|429/i.test(value)) return { code: "RATE_LIMIT", message: "AMM Voice is receiving several requests. Wait a moment and try again." };
    if (/TIMEOUT|timed out|AbortError/i.test(value)) return { code: "TIMEOUT", message: "The request took too long. Your draft is unchanged; please try again." };
    if (/Failed to fetch|Illegal invocation|NetworkError|Load failed|NETWORK|offline/i.test(value)) return { code: "NETWORK", message: "AMM Voice couldn't connect. Your draft is safe. Please try again." };
    if (/MODEL/i.test(value)) return { code: "MODEL", message: "The rewrite could not be completed. Your draft is unchanged; please try again." };
    if (/MALFORMED/i.test(value)) return { code: "MALFORMED_RESPONSE", message: "AMM Voice returned an incomplete response. Your draft is unchanged; please try again." };
    return { code: "API", message: value || "AMM Voice could not complete the request. Your draft is unchanged." };
  }
  function sanitizeTelemetry(name, metadata = {}) {
    const allowedNames = new Set(["extension_opened", "amm_style_requested", "zacs_edit_requested", "rewrite_accepted", "rewrite_retried", "rewrite_undone", "warning_displayed"]); if (!allowedNames.has(name)) return null;
    const safe = {}; for (const key of ["mode", "warningCode", "result", "senderDetected", "questionCount"]) if (["string", "number", "boolean"].includes(typeof metadata[key])) safe[key] = metadata[key];
    return { name, metadata: safe };
  }
  function meaningfulReviewNotes(notes) { return (notes || []).map((value) => String(value || "").trim()).filter((value) => value && !/\b(grammar|spelling|punctuation|comma|capitalization|typo)\b/i.test(value)); }
  function createComposeSession(id = "") { return { id, mode: "amm_style", busy: false, selectedSender: "", output: null, payload: null, undoSnapshot: null }; }
  return { SETTINGS_DEFAULTS, WARNING_MESSAGES, normalizeEmail, resolveSender, extractQuestions, questionCoverage, limitThread, warningView, classifyError, sanitizeTelemetry, meaningfulReviewNotes, createComposeSession };
});
