const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../core.js");
const coaching = require("../outbound-coaching.js");

const enabled = { emailCoachingEnabled: true, senderAddresses: ["cylina@authentic-moments.com", "hello@authentic-moments.com"] };
function context(overrides = {}) { return { composeId: "compose-a", composeMode: "new_compose", senderAddress: "cylina@authentic-moments.com", recipientAddresses: ["client@example.com"], subject: "Final subject", finalBody: "Final manually edited email", threadContext: "Bounded context", conversationRef: "thread-1", ...overrides }; }
function state() { return core.createComposeSession("compose-a"); }
function payload(value, composeState = state()) { return coaching.createOutboundPayload(value, composeState, enabled, { now: () => new Date("2026-09-17T12:00:00.000Z"), idFactory: () => "event-1" }); }

test("new compose, reply, reply all, and forward capture their final outbound mode", () => {
  for (const mode of ["new_compose", "reply", "reply_all", "forward"]) { const result = payload(context({ composeMode: mode })); assert.equal(result.composeMode, mode); assert.equal(result.finalBody, "Final manually edited email"); assert.equal(result.observedAt, "2026-09-17T12:00:00.000Z"); }
});

test("authorized Cylina and hello senders capture while unauthorized traffic is ignored", () => {
  assert.equal(payload(context({ senderAddress: "cylina@authentic-moments.com" })).senderAddress, "cylina@authentic-moments.com");
  assert.equal(payload(context({ senderAddress: "hello@authentic-moments.com" })).senderAddress, "hello@authentic-moments.com");
  assert.equal(payload(context({ senderAddress: "personal@gmail.com" })), null);
});

test("the final manual edit after AMM Style or Zac's Edit is captured instead of the suggestion", () => {
  for (const mode of ["amm_style", "zacs_edit"]) { const composeState = state(); composeState.assistance.ammStyleUsed = mode === "amm_style"; composeState.assistance.zacsEditUsed = mode === "zacs_edit"; composeState.assistance.rewriteAccepted = true; composeState.assistance.lastSuggestion = "AI suggestion"; composeState.assistance.acceptedText = "AI suggestion"; const result = payload(context({ finalBody: "Human changed this after accepting." }), composeState); assert.equal(result.finalBody, "Human changed this after accepting."); assert.equal(result.assistance.rewriteModifiedAfterward, true); assert.equal(JSON.stringify(result).includes("AI suggestion"), false); }
});

test("two compose windows keep independent lineage and deduplication", () => {
  const a = state(); const b = state(); a.assistance.ammStyleUsed = true; b.assistance.zacsEditUsed = true; const deferred = []; const submissions = [];
  const common = { config: enabled, submit: async (value) => { submissions.push(value); return { accepted: true }; }, defer: (task) => deferred.push(task), now: () => new Date("2026-09-17T12:00:00.000Z"), nowMs: () => 1000 };
  assert.equal(coaching.observeOutboundSend({ ...common, context: context({ composeId: "a", finalBody: "A" }), state: a, idFactory: () => "event-a" }), true);
  assert.equal(coaching.observeOutboundSend({ ...common, context: context({ composeId: "b", finalBody: "B" }), state: b, idFactory: () => "event-b" }), true);
  assert.equal(coaching.observeOutboundSend({ ...common, context: context({ composeId: "a", finalBody: "A" }), state: a, idFactory: () => "event-a-duplicate" }), false);
  return Promise.all(deferred.map((task) => task())).then(() => { assert.deepEqual(submissions.map((item) => item.eventId), ["event-a", "event-b"]); assert.equal(submissions[0].assistance.ammStyleUsed, true); assert.equal(submissions[1].assistance.zacsEditUsed, true); });
});

test("capture and backend failures never throw into Gmail's send event", async () => {
  assert.doesNotThrow(() => coaching.observeOutboundSend({ context: null, state: state(), config: enabled, submit: async () => ({ accepted: true }) }));
  const deferred = []; const events = []; const accepted = coaching.observeOutboundSend({ context: context(), state: state(), config: enabled, idFactory: () => "event-fail", now: () => new Date(), nowMs: () => 1, defer: (task) => deferred.push(task), submit: async () => { throw new TypeError("Failed to fetch"); }, emit: (name, metadata) => events.push({ name, metadata }) });
  assert.equal(accepted, true); await deferred[0](); assert.equal(events.at(-1).name, "email_coaching_submission_failed"); assert.equal(events.at(-1).metadata.result, "dropped");
});

test("coaching disabled or missing recipients captures nothing", () => {
  assert.equal(coaching.createOutboundPayload(context(), state(), { ...enabled, emailCoachingEnabled: false }, { idFactory: () => "event" }), null);
  assert.equal(payload(context({ recipientAddresses: [] })), null);
});

test("payload excludes authenticated identity, credentials, and suggestion bodies", () => {
  const composeState = state(); composeState.assistance.originalDraft = "Private original"; composeState.assistance.lastSuggestion = "Private suggestion"; const result = payload(context(), composeState); const serialized = JSON.stringify(result);
  for (const forbidden of ["authenticatedUser", "password", "accessToken", "refreshToken", "Private original", "Private suggestion"]) assert.equal(serialized.includes(forbidden), false);
});

test("implementation has no Sent-mail crawl, Gmail API OAuth, persistent raw-body queue, or Send trigger", () => {
  const sources = ["content-script.js", "service-worker.js", "outbound-coaching.js", "manifest.json"].map((name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8")).join("\n");
  assert.doesNotMatch(sources, /gmail\.googleapis\.com|\/gmail\/v1|chrome\.identity|#sent|setInterval|coachingQueue|pendingEmailBody/i);
  const content = fs.readFileSync(path.join(__dirname, "../content-script.js"), "utf8"); assert.doesNotMatch(content, /\.click\s*\(|stopPropagation\s*\(/); const sendHandler = content.slice(content.indexOf("function observeIntentionalSend"), content.indexOf("function bindSendObserver")); assert.doesNotMatch(sendHandler, /preventDefault\s*\(|await\s+/);
});

test("settings disclose coaching and expose no local policy override", () => {
  const html = fs.readFileSync(path.join(__dirname, "../options.html"), "utf8"); const script = fs.readFileSync(path.join(__dirname, "../options.js"), "utf8");
  assert.match(html, /new outbound Authentic Moments business emails/i); assert.match(html, /does not read historical Sent mail/i); assert.match(html, /never sends email for you/i); assert.doesNotMatch(html, /type="checkbox"[^>]*(email-coaching|coaching-enable)/i); assert.doesNotMatch(script, /emailCoachingEnabled\s*:/);
});
