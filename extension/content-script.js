(function () {
  "use strict";
  const Core = AMMVoiceCore; const Gmail = AMMVoiceCompose; const Lifecycle = AMMVoiceComposeLifecycle; const Coaching = AMMVoiceOutboundCoaching;

  async function call(type, payload) {
    const response = await chrome.runtime.sendMessage({ type, payload });
    if (!response?.ok) throw new Error(response?.error || "AMM Voice request failed.");
    return response.result;
  }
  function emit(name, metadata) { chrome.runtime.sendMessage({ type: "TELEMETRY", name, metadata }).catch(() => {}); }
  async function submitOutboundCoaching(payload) { const response = await chrome.runtime.sendMessage({ type: "SUBMIT_OUTBOUND_EMAIL_COACHING", payload }); if (!response?.ok) throw new Error(response?.error || "EMAIL_COACHING_SUBMISSION_FAILED"); return response.result; }
  async function extensionSettings() { const saved = await chrome.storage.local.get(Object.keys(Core.SETTINGS_DEFAULTS)); return { ...Core.SETTINGS_DEFAULTS, ...saved }; }
  function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; }
  function button(text, className, label = text) { const node = element("button", className, text); node.type = "button"; node.setAttribute("aria-label", label); return node; }

  function createPanel() {
    const shell = element("section", "amm-voice-shell"); shell.setAttribute("aria-label", "AMM Voice email assistant");
    const actionBar = element("div", "amm-voice-actions");
    const ammButton = button("AMM Style", "amm-voice-action amm-voice-action--style", "Polish this draft with AMM Style");
    const zacButton = button("Zac's Edit", "amm-voice-action amm-voice-action--zac", "Run Zac's deeper customer-service review");
    actionBar.append(ammButton, zacButton);

    const panel = element("div", "amm-voice-panel"); panel.hidden = true; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "false"); panel.setAttribute("aria-labelledby", `amm-title-${Math.random().toString(36).slice(2)}`);
    const header = element("div", "amm-voice-panel__header"); const headingWrap = element("div"); const eyebrow = element("p", "amm-voice-eyebrow", "AMM Voice"); const title = element("h3", "amm-voice-title", "Suggested response"); title.id = panel.getAttribute("aria-labelledby"); const subtitle = element("p", "amm-voice-subtitle", "Polish the draft while preserving facts and intent."); headingWrap.append(eyebrow, title, subtitle); const close = button("×", "amm-voice-icon-button", "Close AMM Voice panel"); header.append(headingWrap, close);

    const senderRow = element("div", "amm-voice-field"); senderRow.hidden = true; const senderLabel = element("label", "amm-voice-label", "Send from"); const sender = element("select", "amm-voice-select"); senderLabel.append(sender); const senderHelp = element("p", "amm-voice-help", "Choose one of your backend-authorized sender identities."); senderRow.append(senderLabel, senderHelp);
    const status = element("div", "amm-voice-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    const continueButton = button("Continue", "amm-voice-button amm-voice-button--primary"); continueButton.hidden = true;

    const result = element("div", "amm-voice-result"); result.hidden = true;
    const suggestedLabel = element("h4", "amm-voice-section-title", "Suggested response"); const suggested = element("div", "amm-voice-suggestion"); suggested.tabIndex = 0;
    const warnings = element("section", "amm-voice-review-block"); warnings.hidden = true; const warningTitle = element("h4", "amm-voice-section-title", "Things to check"); const warningList = element("ul", "amm-voice-list"); warnings.append(warningTitle, warningList);
    const review = element("section", "amm-voice-review-block"); review.hidden = true; const reviewTitle = element("h4", "amm-voice-section-title", "Zac Review"); const reviewList = element("ul", "amm-voice-list"); review.append(reviewTitle, reviewList);
    const questions = element("section", "amm-voice-review-block"); questions.hidden = true; const questionTitle = element("h4", "amm-voice-section-title", "Client questions detected"); const questionList = element("ul", "amm-voice-question-list"); questions.append(questionTitle, questionList);
    result.append(suggestedLabel, suggested, warnings, review, questions);

    const footer = element("div", "amm-voice-footer"); footer.hidden = true;
    const replace = button("Replace Draft", "amm-voice-button amm-voice-button--primary"); const retry = button("Try Again", "amm-voice-button amm-voice-button--secondary"); const undo = button("Undo", "amm-voice-button amm-voice-button--secondary"); undo.disabled = true; const cancel = button("Cancel", "amm-voice-button amm-voice-button--quiet"); footer.append(replace, retry, undo, cancel);
    panel.append(header, senderRow, status, continueButton, result, footer); shell.append(actionBar, panel);

    return { shell, actionBar, panel, ammButton, zacButton, close, title, subtitle, senderRow, sender, status, continueButton, result, suggested, warnings, warningList, review, reviewList, questions, questionList, footer, replace, retry, undo, cancel };
  }

  function attachControls(compose, state) {
    compose.querySelectorAll?.(".amm-voice-shell").forEach((node) => { if (node !== state.ui.shell) node.remove(); });
    const mount = Gmail.composeMount(compose); if (mount.before) mount.parent.insertBefore(state.ui.shell, mount.before); else mount.parent.prepend(state.ui.shell);
  }

  function setBusy(state, busy, label) {
    state.busy = busy; state.ui.ammButton.disabled = busy; state.ui.zacButton.disabled = busy; state.ui.continueButton.disabled = busy; state.ui.retry.disabled = busy;
    state.ui.status.className = `amm-voice-status${busy ? " amm-voice-status--loading" : ""}`; state.ui.status.textContent = label || "";
  }
  function showError(state, error) { const view = Core.classifyError(error); state.errorCode = view.code; setBusy(state, false); state.ui.status.className = "amm-voice-status amm-voice-status--error"; state.ui.status.textContent = view.message; state.ui.continueButton.hidden = false; state.ui.continueButton.textContent = view.code === "AUTH_REQUIRED" ? "Open sign-in settings" : "Try again"; }
  function renderSender(state, senderState) {
    const ui = state.ui; ui.sender.replaceChildren(); senderState.options.forEach((address) => { const option = element("option", "", address); option.value = address; ui.sender.append(option); });
    ui.senderRow.hidden = !senderState.needsSelection; state.selectedSender = senderState.sender;
    if (senderState.needsSelection) { if (senderState.options.length) state.selectedSender = senderState.options[0]; else state.selectedSender = ""; ui.sender.value = state.selectedSender; }
  }
  function listItems(list, values) { list.replaceChildren(); values.forEach((value) => { const item = element("li", "", value); list.append(item); }); }
  function renderResult(state, output) {
    const ui = state.ui; state.output = output; state.assistance.lastSuggestion = output.rewrittenText || ""; ui.result.hidden = false; ui.footer.hidden = false; ui.continueButton.hidden = true; ui.suggested.textContent = output.rewrittenText || "";
    const warningViews = (output.warnings || []).map(Core.warningView); state.assistance.warningCodes = [...new Set([...state.assistance.warningCodes, ...warningViews.map((item) => item.code)])]; listItems(ui.warningList, warningViews.map((item) => item.message)); ui.warnings.hidden = warningViews.length === 0; warningViews.forEach((item) => emit("warning_displayed", { mode: state.mode, warningCode: item.code }));
    const reviewItems = state.mode === "zacs_edit" && state.settings.showZacReview ? Core.meaningfulReviewNotes(output.reviewNotes) : []; listItems(ui.reviewList, reviewItems); ui.review.hidden = reviewItems.length === 0;
    const detected = Core.extractQuestions(state.context.thread); const coverage = Core.questionCoverage(detected, output.rewrittenText); const useful = state.mode === "zacs_edit" && (coverage.length > 1 || coverage.some((item) => !item.covered));
    ui.questionList.replaceChildren(); if (useful) coverage.forEach((item) => { const row = element("li", item.covered ? "is-covered" : "needs-review"); const mark = element("span", "amm-voice-question-mark", item.covered ? "✓" : "!"); mark.setAttribute("aria-label", item.covered ? "Likely covered" : "Review coverage"); row.append(mark, document.createTextNode(item.question)); ui.questionList.append(row); }); ui.questions.hidden = !useful; if (useful && coverage.some((item) => !item.covered)) state.assistance.questionCoverageWarningDisplayed = true;
    setBusy(state, false, state.context.thread ? "Review the suggestion before replacing your draft." : "No thread context was detected. Review this suggestion carefully."); ui.suggested.focus();
  }

  async function configFor(state) { const config = await call("GET_CONFIG"); state.coachingConfig = config; return config; }
  function hydrateCoachingConfig(state) { configFor(state).catch(() => { state.coachingConfig = null; }); }
  async function runRewrite(state, retry = false) {
    if (state.busy) return; state.errorCode = ""; state.context = Gmail.composeContext(state.compose); state.settings = await extensionSettings(); state.ui.panel.hidden = false; state.ui.title.textContent = state.mode === "zacs_edit" ? "Zac's Edit" : "AMM Style"; state.ui.subtitle.textContent = state.mode === "zacs_edit" ? "A deeper customer-service review for clarity, questions, promises, and next steps." : "A polished Authentic Moments response with warmth, clarity, and facts intact."; state.ui.result.hidden = true; state.ui.footer.hidden = true; state.ui.continueButton.hidden = true;
    if (!state.context.body || !state.context.draft) { showError(state, new Error("NO_DRAFT")); return; }
    if (!state.assistance.originalDraft) state.assistance.originalDraft = state.context.draft; if (state.mode === "zacs_edit") state.assistance.zacsEditUsed = true; else state.assistance.ammStyleUsed = true;
    try {
      setBusy(state, true, state.mode === "zacs_edit" ? "Analyzing the conversation…" : "Polishing your draft…"); const config = await configFor(state); state.config = config;
      const senderState = Core.resolveSender(state.context.senderAddress, config.senderAddresses || [], state.settings.autoDetectSender); renderSender(state, senderState);
      if (senderState.needsSelection) { setBusy(state, false, senderState.options.length ? "Confirm the From address before continuing." : "No authorized sender identities are available."); state.ui.continueButton.hidden = senderState.options.length === 0; state.ui.continueButton.textContent = "Continue"; return; }
      const payload = { mode: state.mode, draft: state.context.draft, subject: state.context.subject, thread: state.context.thread, senderAddress: state.selectedSender };
      if (state.context.recipientAddress) payload.recipientAddress = state.context.recipientAddress; if (state.context.conversationId) payload.conversationId = state.context.conversationId; state.payload = payload;
      emit(retry ? "rewrite_retried" : state.mode === "zacs_edit" ? "zacs_edit_requested" : "amm_style_requested", { mode: state.mode, senderDetected: senderState.detected, questionCount: Core.extractQuestions(state.context.thread).length });
      renderResult(state, await call(retry ? "RETRY_REWRITE" : "REWRITE", payload));
    } catch (error) { showError(state, error); }
  }
  async function continueWithSender(state) {
    if (!state.selectedSender) { showError(state, new Error("SENDER_REQUIRED")); return; } state.errorCode = "";
    state.context = Gmail.composeContext(state.compose); setBusy(state, true, state.mode === "zacs_edit" ? "Analyzing the conversation…" : "Polishing your draft…"); state.ui.continueButton.hidden = true;
    const payload = { mode: state.mode, draft: state.context.draft, subject: state.context.subject, thread: state.context.thread, senderAddress: state.selectedSender }; if (state.context.recipientAddress) payload.recipientAddress = state.context.recipientAddress; if (state.context.conversationId) payload.conversationId = state.context.conversationId; state.payload = payload;
    try { emit(state.mode === "zacs_edit" ? "zacs_edit_requested" : "amm_style_requested", { mode: state.mode, senderDetected: false, questionCount: Core.extractQuestions(state.context.thread).length }); renderResult(state, await call("REWRITE", payload)); } catch (error) { showError(state, error); }
  }
  function closePanel(state) { if (state.busy) return; state.ui.panel.hidden = true; state.ui.result.hidden = true; state.ui.status.textContent = ""; }
  function observeIntentionalSend(state, event) {
    if (event.isTrusted === false || !Gmail.isSendControl(event.target, state.compose)) return;
    let context; try { context = Gmail.outboundContext(state.compose); } catch { return; }
    Coaching.observeOutboundSend({ context, state, config: state.coachingConfig, submit: submitOutboundCoaching, emit });
  }
  function bindSendObserver(state, compose) {
    if (state.sendObserver?.compose === compose) return; if (state.sendObserver) state.sendObserver.compose.removeEventListener("click", state.sendObserver.listener, true);
    const listener = (event) => observeIntentionalSend(state, event); compose.addEventListener("click", listener, true); state.sendObserver = { compose, listener };
  }
  function clearComposeState(state) {
    if (state.sendObserver) state.sendObserver.compose.removeEventListener("click", state.sendObserver.listener, true); state.sendObserver = null;
    state.context = null; state.output = null; state.payload = null; state.undoSnapshot = null; state.coachingConfig = null; state.coachingSendDedup = null; state.assistance.originalDraft = ""; state.assistance.lastSuggestion = ""; state.assistance.acceptedText = "";
  }
  function wireState(compose, ui) {
    const state = { ...Core.createComposeSession(compose.getAttribute("data-thread-perm-id") || ""), compose, ui, settings: Core.SETTINGS_DEFAULTS };
    ui.ammButton.addEventListener("click", () => { state.mode = "amm_style"; emit("extension_opened", { mode: state.mode }); runRewrite(state); }); ui.zacButton.addEventListener("click", () => { state.mode = "zacs_edit"; emit("extension_opened", { mode: state.mode }); runRewrite(state); });
    ui.close.addEventListener("click", () => closePanel(state)); ui.cancel.addEventListener("click", () => closePanel(state)); ui.sender.addEventListener("change", () => { state.selectedSender = ui.sender.value; }); ui.continueButton.addEventListener("click", () => { if (state.errorCode === "AUTH_REQUIRED") { call("OPEN_SETTINGS").catch(() => {}); return; } state.ui.senderRow.hidden ? runRewrite(state) : continueWithSender(state); });
    ui.retry.addEventListener("click", () => runRewrite(state, true)); ui.replace.addEventListener("click", () => { if (!state.output?.rewrittenText) return; state.undoSnapshot = Gmail.replaceDraftBody(Gmail.findBody(state.compose), state.output.rewrittenText); state.assistance.rewriteAccepted = true; state.assistance.acceptedText = state.output.rewrittenText; ui.undo.disabled = false; ui.status.textContent = "Draft replaced. Review it in Gmail before sending."; emit("rewrite_accepted", { mode: state.mode }); });
    ui.undo.addEventListener("click", () => { if (Gmail.restoreDraftBody(Gmail.findBody(state.compose), state.undoSnapshot)) { state.undoSnapshot = null; ui.undo.disabled = true; ui.status.textContent = "The previous draft has been restored."; emit("rewrite_undone", { mode: state.mode }); } });
    ui.panel.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.preventDefault(); closePanel(state); (state.mode === "zacs_edit" ? ui.zacButton : ui.ammButton).focus(); } });
    extensionSettings().then((settings) => { state.settings = settings; if (settings.defaultAction === "zacs_edit") ui.actionBar.prepend(ui.zacButton); }).catch(() => {}); bindSendObserver(state, compose); hydrateCoachingConfig(state); return state;
  }

  const lifecycle = Lifecycle.createComposeLifecycle({
    identityFor: Gmail.composeIdentity,
    createState: (compose) => wireState(compose, createPanel()),
    controlsAttached: (compose, state) => { const shells = compose.querySelectorAll(".amm-voice-shell"); return shells.length === 1 && shells[0] === state.ui.shell && state.ui.shell.isConnected && compose.contains(state.ui.shell); },
    attachControls,
    onRebind: (state, compose) => { state.compose = compose; bindSendObserver(state, compose); },
    onCleanup: (state) => { clearComposeState(state); state.ui.shell.remove(); state.compose = null; }
  });

  function composeCandidates(root, candidates) {
    if (root?.nodeType !== Node.ELEMENT_NODE) return;
    if (root.matches?.('[role="dialog"]')) candidates.add(root);
    root.querySelectorAll?.('[role="dialog"]').forEach((compose) => candidates.add(compose));
  }
  function composeContaining(node) { return node?.nodeType === Node.ELEMENT_NODE ? node.closest?.('[role="dialog"]') : node?.parentElement?.closest?.('[role="dialog"]'); }
  function mutationTouchesComposeChrome(record, compose) {
    const body = Gmail.findBody(compose); if (body && (record.target === body || body.contains(record.target))) return false;
    return [...record.addedNodes, ...record.removedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE);
  }
  let reconcileQueued = false; const pendingComposes = new Set();
  function queueReconcile() {
    if (reconcileQueued) return; reconcileQueued = true;
    queueMicrotask(() => { reconcileQueued = false; const ready = [...pendingComposes].filter((compose) => compose.isConnected && Gmail.findBody(compose)); pendingComposes.clear(); lifecycle.reconcile(ready); lifecycle.cleanupDisconnected(); });
  }
  function observe(records) {
    let relevant = false;
    records.forEach((record) => {
      record.addedNodes.forEach((node) => composeCandidates(node, pendingComposes));
      const compose = composeContaining(record.target);
      if (compose && mutationTouchesComposeChrome(record, compose)) { pendingComposes.add(compose); relevant = true; }
      if ([...record.addedNodes, ...record.removedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE && (node.matches?.(".amm-voice-shell, [role=dialog]") || node.querySelector?.(".amm-voice-shell, [role=dialog]")))) relevant = true;
    });
    if (relevant || pendingComposes.size) queueReconcile();
  }
  const observer = new MutationObserver(observe);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  lifecycle.reconcile([...document.querySelectorAll('[role="dialog"]')].filter((compose) => Gmail.findBody(compose)));
})();
