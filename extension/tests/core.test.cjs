const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../core.js");

test("sender detection never guesses outside backend-authorized identities", () => {
  assert.deepEqual(core.resolveSender("Cylina <cylina@authentic-moments.com>", ["hello@authentic-moments.com", "cylina@authentic-moments.com"]), { sender: "cylina@authentic-moments.com", options: ["hello@authentic-moments.com", "cylina@authentic-moments.com"], needsSelection: false, detected: true });
  assert.equal(core.resolveSender("unknown@example.com", ["hello@authentic-moments.com"]).needsSelection, true);
  assert.equal(core.resolveSender("", ["hello@authentic-moments.com"]).sender, "");
});

test("compose sessions remain isolated", () => {
  const a = core.createComposeSession("a"); const b = core.createComposeSession("b"); a.mode = "amm_style"; a.selectedSender = "hello@authentic-moments.com"; b.mode = "zacs_edit"; b.selectedSender = "cylina@authentic-moments.com"; a.output = { rewrittenText: "A" };
  assert.deepEqual({ mode: a.mode, sender: a.selectedSender, text: a.output.rewrittenText }, { mode: "amm_style", sender: "hello@authentic-moments.com", text: "A" });
  assert.deepEqual({ mode: b.mode, sender: b.selectedSender, output: b.output }, { mode: "zacs_edit", sender: "cylina@authentic-moments.com", output: null });
});

test("thread limiting keeps recent context within bounds", () => {
  const messages = Array.from({ length: 10 }, (_, index) => `message-${index}-${"x".repeat(40)}`); const output = core.limitThread(messages, { maxMessages: 3, maxChars: 130 });
  assert.equal(output.includes("message-0"), false); assert.equal(output.includes("message-9"), true); assert.ok(output.length <= 150);
});

test("question coverage and calm warnings are UI-ready", () => {
  const questions = core.extractQuestions("When will the teaser be ready? Can we buy raw footage? Do you need another song?"); assert.equal(questions.length, 3);
  const coverage = core.questionCoverage(questions, "The teaser should be ready next week, and raw footage can be purchased."); assert.equal(coverage.some((item) => !item.covered), true);
  assert.match(core.warningView("UNSUPPORTED_PROMISE").message, /Potential promise/);
  assert.deepEqual(core.meaningfulReviewNotes(["Fixed a comma.", "The draft does not explain what happens next."]), ["The draft does not explain what happens next."]);
});

test("error mapping preserves actionable recovery", () => {
  assert.equal(core.classifyError(new Error("SIGN_IN_REQUIRED")).code, "AUTH_REQUIRED"); assert.equal(core.classifyError(new Error("429")).code, "RATE_LIMIT"); assert.equal(core.classifyError(new TypeError("Illegal invocation")).code, "NETWORK"); assert.match(core.classifyError(new Error("Failed to fetch")).message, /draft is safe/); assert.equal(core.classifyError(new Error("MALFORMED_REWRITE_RESPONSE")).code, "MALFORMED_RESPONSE");
});

test("telemetry strips email content and accepts only conceptual events", () => {
  assert.deepEqual(core.sanitizeTelemetry("rewrite_accepted", { mode: "amm_style", draft: "private body", thread: "private thread" }), { name: "rewrite_accepted", metadata: { mode: "amm_style" } }); assert.equal(core.sanitizeTelemetry("unknown_event", {}), null);
  assert.deepEqual(core.sanitizeTelemetry("email_coaching_submission_failed", { composeMode: "reply", assistanceUsed: true, finalBody: "private", reasonCode: "network" }), { name: "email_coaching_submission_failed", metadata: { composeMode: "reply", assistanceUsed: true, reasonCode: "network" } });
});

test("fixture corpus covers requested AMM Style and Zac's Edit scenarios", () => {
  const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "../fixtures/rewrite-scenarios.json"), "utf8")); assert.equal(fixtures.filter((item) => item.mode === "amm_style").length, 9); assert.equal(fixtures.filter((item) => item.mode === "zacs_edit").length, 10); assert.equal(new Set(fixtures.map((item) => item.id)).size, fixtures.length);
});

test("content lifecycle observes removals without polling and loads before the content script", () => {
  const content = fs.readFileSync(path.join(__dirname, "../content-script.js"), "utf8"); const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "../manifest.json"), "utf8"));
  assert.match(content, /record\.removedNodes/); assert.match(content, /controlsAttached/); assert.doesNotMatch(content, /setInterval/); assert.deepEqual(manifest.content_scripts[0].js.slice(-3), ["compose-lifecycle.js", "outbound-coaching.js", "content-script.js"]);
});
