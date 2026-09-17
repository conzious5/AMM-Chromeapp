(function (root, factory) {
  const api = factory(root.AMMVoiceCore || (typeof require === "function" ? require("./core.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AMMVoiceOutboundCoaching = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (core) {
  "use strict";
  const DEDUPE_WINDOW_MS = 15000;

  function text(value) { return String(value || "").trim(); }
  function normalizedBody(value) { return text(value).replace(/\s+/g, " "); }
  function unique(values) { return [...new Set((values || []).map((value) => text(value)).filter(Boolean))]; }
  function quickHash(value) { let hash = 2166136261; for (const char of String(value || "")) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }

  function assistanceMetadata(state, finalBody) {
    const assistance = state?.assistance || {};
    return {
      ammStyleUsed: Boolean(assistance.ammStyleUsed),
      zacsEditUsed: Boolean(assistance.zacsEditUsed),
      rewriteAccepted: Boolean(assistance.rewriteAccepted),
      rewriteModifiedAfterward: Boolean(assistance.rewriteAccepted && normalizedBody(finalBody) !== normalizedBody(assistance.acceptedText)),
      warningsDisplayed: unique(assistance.warningCodes),
      questionCoverageWarningDisplayed: Boolean(assistance.questionCoverageWarningDisplayed)
    };
  }

  function createOutboundPayload(context, state, config, options = {}) {
    if (config?.emailCoachingEnabled !== true) return null;
    const senderAddress = core.normalizeEmail(context?.senderAddress);
    const allowed = new Set((config.senderAddresses || []).map(core.normalizeEmail).filter(Boolean));
    if (!senderAddress || !allowed.has(senderAddress)) return null;
    const recipientAddresses = unique((context.recipientAddresses || []).map(core.normalizeEmail).filter(Boolean));
    if (!recipientAddresses.length) return null;
    const finalBody = String(context.finalBody || "");
    const observedAt = (options.now ? options.now() : new Date()).toISOString();
    const eventId = options.idFactory ? options.idFactory() : crypto.randomUUID();
    const payload = {
      eventId,
      observedAt,
      composeId: text(context.composeId),
      composeMode: context.composeMode || "unknown",
      senderAddress,
      recipientAddresses,
      subject: String(context.subject || ""),
      finalBody,
      assistance: assistanceMetadata(state, finalBody)
    };
    if (context.conversationRef) payload.conversationRef = String(context.conversationRef);
    if (context.threadContext) payload.threadContext = String(context.threadContext);
    return payload;
  }

  function payloadFingerprint(payload) {
    return quickHash(JSON.stringify([payload.composeId, payload.senderAddress, payload.recipientAddresses, payload.subject, payload.finalBody, payload.conversationRef || ""]));
  }

  function observeOutboundSend(options) {
    try {
      const payload = createOutboundPayload(options.context, options.state, options.config, options);
      if (!payload) return false;
      const nowMs = options.nowMs ? options.nowMs() : Date.now(); const fingerprint = payloadFingerprint(payload); const previous = options.state.coachingSendDedup;
      if (previous && previous.fingerprint === fingerprint && nowMs - previous.observedAtMs < DEDUPE_WINDOW_MS) return false;
      options.state.coachingSendDedup = { fingerprint, observedAtMs: nowMs };
      const telemetry = { composeMode: payload.composeMode, assistanceUsed: payload.assistance.ammStyleUsed || payload.assistance.zacsEditUsed };
      options.emit?.("email_sent_observed", telemetry);
      const defer = options.defer || queueMicrotask;
      defer(async () => {
        options.emit?.("email_coaching_submission_started", telemetry);
        try {
          const result = await options.submit(payload);
          if (result?.accepted === false) throw new Error(result.reason || "EMAIL_COACHING_NOT_ACCEPTED");
          options.emit?.("email_coaching_submission_succeeded", { ...telemetry, result: "accepted" });
        } catch (error) {
          options.emit?.("email_coaching_submission_failed", { ...telemetry, result: "dropped", reasonCode: text(error?.code || error?.message || "submission_failed").slice(0, 80) });
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  return { DEDUPE_WINDOW_MS, assistanceMetadata, createOutboundPayload, payloadFingerprint, observeOutboundSend };
});
