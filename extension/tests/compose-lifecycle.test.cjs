const test = require("node:test");
const assert = require("node:assert/strict");
const { createComposeLifecycle } = require("../compose-lifecycle.js");

function fixture() {
  const attachments = [];
  const lifecycle = createComposeLifecycle({
    identityFor: (compose) => compose.id,
    isConnected: (compose) => Boolean(compose?.connected),
    createState: (compose) => ({ compose, selectedSender: "", output: null, panelOpen: false, undoSnapshot: null, shell: { attachedTo: null } }),
    controlsAttached: (compose, state) => state.shell.attachedTo === compose,
    attachControls: (compose, state) => { state.shell.attachedTo = compose; attachments.push(compose.id); },
    onRebind: (state, compose) => { state.compose = compose; },
    onCleanup: (state) => { state.cleaned = true; state.shell.attachedTo = null; state.compose = null; }
  });
  return { lifecycle, attachments };
}

function compose(id, draftHtml) { return { id, connected: true, draftHtml }; }

test("controls attach initially and reattach after Gmail replaces the toolbar without resetting state", () => {
  const { lifecycle, attachments } = fixture(); const draft = compose("compose-a", "<p>Hello</p><div class='gmail_signature'>Signature</div><div class='gmail_quote'>Quoted history</div>");
  const state = lifecycle.ensure(draft); state.selectedSender = "hello@authentic-moments.com"; state.output = { rewrittenText: "Suggestion" }; state.panelOpen = true; state.undoSnapshot = { html: draft.draftHtml };
  state.shell.attachedTo = null; lifecycle.reconcile([draft]);
  assert.deepEqual(attachments, ["compose-a", "compose-a"]); assert.equal(lifecycle.stateFor(draft), state); assert.equal(state.selectedSender, "hello@authentic-moments.com"); assert.deepEqual(state.output, { rewrittenText: "Suggestion" }); assert.equal(state.panelOpen, true); assert.equal(draft.draftHtml, "<p>Hello</p><div class='gmail_signature'>Signature</div><div class='gmail_quote'>Quoted history</div>"); assert.deepEqual(state.undoSnapshot, { html: draft.draftHtml });
});

test("an attached compose is never injected twice", () => {
  const { lifecycle, attachments } = fixture(); const draft = compose("compose-a", "Draft");
  lifecycle.ensure(draft); lifecycle.ensure(draft); lifecycle.reconcile([draft, draft]);
  assert.deepEqual(attachments, ["compose-a"]); assert.equal(lifecycle.liveStateCount(), 1);
});

test("toolbar recovery remains isolated across simultaneous compose windows", () => {
  const { lifecycle, attachments } = fixture(); const a = compose("compose-a", "A"); const b = compose("compose-b", "B");
  const stateA = lifecycle.ensure(a); const stateB = lifecycle.ensure(b); stateA.selectedSender = "hello@authentic-moments.com"; stateB.selectedSender = "cylina@authentic-moments.com";
  stateA.shell.attachedTo = null; lifecycle.reconcile([a]);
  assert.deepEqual(attachments, ["compose-a", "compose-b", "compose-a"]); assert.equal(stateA.selectedSender, "hello@authentic-moments.com"); assert.equal(stateB.selectedSender, "cylina@authentic-moments.com"); assert.equal(stateB.shell.attachedTo, b);
});

test("a safely identifiable replacement compose reuses state while a genuinely closed compose is cleaned up", () => {
  const { lifecycle } = fixture(); const original = compose("reply-123", "Reply"); const state = lifecycle.ensure(original); state.selectedSender = "hello@authentic-moments.com"; original.connected = false;
  const replacement = compose("reply-123", "Reply"); lifecycle.reconcile([replacement]);
  assert.equal(lifecycle.stateFor(replacement), state); assert.equal(state.selectedSender, "hello@authentic-moments.com"); assert.equal(state.cleaned, undefined);
  replacement.connected = false; lifecycle.cleanupDisconnected(); assert.equal(state.cleaned, true); assert.equal(lifecycle.liveStateCount(), 0);
});

test("new compose, reply, reply all, and forward lifecycle identities recover independently", () => {
  for (const id of ["new-compose", "reply", "reply-all", "forward"]) {
    const { lifecycle, attachments } = fixture(); const draft = compose(id, `<p>${id}</p>`); lifecycle.ensure(draft); draft.connected = false; const replacement = compose(id, `<p>${id}</p>`); lifecycle.reconcile([replacement]); assert.deepEqual(attachments, [id, id]); assert.equal(replacement.draftHtml, `<p>${id}</p>`);
  }
});
