const harnessStorage = { defaultAction: "amm_style", showZacReview: true, autoDetectSender: true };
globalThis.chrome = {
  storage: { local: { async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((key) => key in harnessStorage).map((key) => [key, harnessStorage[key]])); }, async set(value) { Object.assign(harnessStorage, value); } } },
  runtime: { async sendMessage(message) {
    if (message.type === "GET_CONFIG" || message.type === "SIGN_IN") return { ok: true, result: { authenticatedUser: "developer@amm-voice.local", senderAddresses: ["hello@authentic-moments.com", "cylina@authentic-moments.com"], emailCoachingEnabled: true } };
    if (message.type === "TELEMETRY") return { ok: true, result: { accepted: true } };
    if (message.type === "SUBMIT_OUTBOUND_EMAIL_COACHING") return { ok: true, result: { accepted: true } };
    if (message.type === "REWRITE" || message.type === "RETRY_REWRITE") {
      const zac = message.payload.mode === "zacs_edit";
      return { ok: true, result: { rewrittenText: zac ? "Thanks for checking in. The teaser is still in progress, and I will confirm its estimated timing and the raw-footage options for you. Could you send the alternate song you are considering?" : "Thanks so much for checking in! The teaser is in progress, and I will follow up with the latest timing as soon as I confirm it.", reviewNotes: zac ? ["The original draft did not address the client's song question.", "The revised response keeps timing unconfirmed rather than making a promise."] : [], warnings: zac ? ["MISSING_QUESTION", "TIMELINE_AMBIGUITY"] : [] } };
    }
    return { ok: false, error: "Unsupported harness message." };
  } }
};
