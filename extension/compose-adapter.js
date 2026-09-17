(function (root, factory) {
  const api = factory(root.AMMVoiceCore || (typeof require === "function" ? require("./core.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AMMVoiceCompose = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (core) {
  "use strict";
  const BODY_SELECTOR = '[contenteditable="true"][role="textbox"]'; const PROTECTED_SELECTOR = ".gmail_signature, .gmail_quote, [data-smartmail=\"gmail_signature\"]";
  const COMPOSE_BOUNDARY_SELECTOR = '[role="dialog"], [role="region"]';
  const COMPOSE_MODES = Object.freeze({ NEW_COMPOSE: "new_compose", REPLY: "reply", REPLY_ALL: "reply_all", FORWARD: "forward" });
  function textOf(element) { return element?.innerText?.trim() || element?.textContent?.trim() || ""; }
  function findBody(compose) {
    const candidates = [...(compose?.querySelectorAll?.(BODY_SELECTOR) || [])];
    return candidates.find((node) => node.getAttribute?.("g_editable") === "true") || candidates.find((node) => !/describe your message/i.test(node.getAttribute?.("aria-label") || "")) || null;
  }
  function isComposeBody(node) { return Boolean(node?.matches?.(BODY_SELECTOR) && (node.getAttribute?.("g_editable") === "true" || /message body/i.test(node.getAttribute?.("aria-label") || ""))); }
  function hasSendControl(compose) { return Boolean(compose?.querySelector?.('[role="button"][aria-label="Send"], [role="button"][data-tooltip="Send"]')); }
  function composeRootForBody(body) {
    if (!isComposeBody(body)) return null;
    const dialog = body.closest?.('[role="dialog"]'); if (dialog && hasSendControl(dialog)) return dialog;
    const region = body.closest?.('[role="region"]'); if (region && hasSendControl(region)) return region;
    return null;
  }
  function composeRootForNode(node) {
    const element = node?.nodeType === 1 ? node : node?.parentElement; if (!element) return null;
    if (isComposeBody(element)) return composeRootForBody(element);
    let boundary = element.closest?.(COMPOSE_BOUNDARY_SELECTOR);
    while (boundary) {
      if (findBody(boundary) && hasSendControl(boundary)) return boundary;
      boundary = boundary.parentElement?.closest?.(COMPOSE_BOUNDARY_SELECTOR);
    }
    return null;
  }
  function findComposeRoots(scope) {
    const roots = new Set();
    if (isComposeBody(scope)) { const own = composeRootForBody(scope); if (own) roots.add(own); }
    for (const body of scope?.querySelectorAll?.(BODY_SELECTOR) || []) { const compose = composeRootForBody(body); if (compose) roots.add(compose); }
    return [...roots];
  }
  function composeMount(compose) {
    const sendButton = compose?.querySelector?.('[role="button"][aria-label="Send"], [role="button"][data-tooltip^="Send"]'); const sendTable = sendButton?.closest?.("table");
    if (sendTable?.parentElement) return { parent: sendTable.parentElement, before: sendTable };
    const toolbars = [...(compose?.querySelectorAll?.('[role="toolbar"]') || [])]; const toolbar = toolbars.find((node) => node.parentElement && (node.parentElement.offsetWidth || node.parentElement.offsetHeight)) || toolbars[0];
    return { parent: toolbar?.parentElement || compose, before: null };
  }
  function composeIdentity(compose) { return compose?.getAttribute?.("data-thread-perm-id") || compose?.getAttribute?.("aria-labelledby") || compose?.getAttribute?.("data-amm-compose-id") || ""; }
  function ensureComposeIdentity(compose) {
    const existing = composeIdentity(compose); if (existing) return existing;
    const generated = `amm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; compose?.setAttribute?.("data-amm-compose-id", generated); return generated;
  }
  function draftText(body) { if (!body) return ""; const copy = body.cloneNode(true); copy.querySelectorAll?.(PROTECTED_SELECTOR).forEach((node) => node.remove()); return textOf(copy); }
  function detectSender(compose) {
    const selectors = ['input[name="from"]', '[name="from"] [email]', '[data-tooltip^="From:"]', '[aria-label^="From:"]', '[aria-label^="From "]'];
    for (const selector of selectors) { const node = compose.querySelector(selector); const candidate = node?.value || node?.getAttribute?.("email") || node?.getAttribute?.("data-hovercard-id") || node?.getAttribute?.("data-tooltip") || node?.getAttribute?.("aria-label") || textOf(node); const email = core.normalizeEmail(candidate); if (email) return email; }
    return "";
  }
  function isSenderNode(node) { const own = [node?.getAttribute?.("name"), node?.getAttribute?.("aria-label"), node?.getAttribute?.("data-tooltip")].join(" "); return /(^|\s)from(?:\s|:|$)/i.test(own) || Boolean(node?.closest?.('[name="from"], [aria-label^="From:"], [aria-label^="From "], [data-tooltip^="From:"]')); }
  function recipientAddresses(compose) {
    const body = findBody(compose); const addresses = [];
    const nodes = [...(compose?.querySelectorAll?.('[email], [data-hovercard-id*="@"], input[name="to"], input[name="cc"], input[name="bcc"]') || [])];
    for (const node of nodes) { if (body?.contains?.(node) || node.closest?.(".amm-voice-shell") || isSenderNode(node)) continue; const address = core.normalizeEmail(node.getAttribute?.("email") || node.getAttribute?.("data-hovercard-id") || node.value || textOf(node)); if (address) addresses.push(address); }
    return [...new Set(addresses)];
  }
  function recipientAddress(compose) { return recipientAddresses(compose)[0] || ""; }
  function threadMessages(documentRef, body) {
    const nodes = [...documentRef.querySelectorAll(".a3s.aiL, [data-message-id] .a3s")];
    return nodes.filter((node) => node !== body && !body?.contains?.(node) && !node.contains?.(body)).map((node) => {
      const message = node.closest?.('[data-message-id], .adn'); const sender = message?.querySelector?.('.gD[email], .gD[data-hovercard-id*="@"]');
      return { text: textOf(node), senderAddress: core.normalizeEmail(sender?.getAttribute?.("email") || sender?.getAttribute?.("data-hovercard-id") || "") };
    });
  }
  function rewriteThreadContext(context, ownAddresses = []) { return core.buildLabeledThreadContext(context?.threadMessages || [], { draft: context?.draft, subject: context?.subject, ownAddresses, maxMessages: 5, maxChars: 12000 }); }
  function composeContext(compose, documentRef = document) {
    const body = findBody(compose); const subject = compose.querySelector('input[name="subjectbox"]')?.value || documentRef.querySelector("h2.hP")?.textContent?.trim() || "";
    const hash = documentRef?.location?.hash || (typeof location !== "undefined" ? location.hash : ""); const conversationId = hash.match(/[a-f0-9]{16,}/i)?.[0] || compose.getAttribute("data-thread-perm-id") || "";
    const context = { body, subject, draft: draftText(body), recipientAddress: recipientAddress(compose), senderAddress: detectSender(compose), threadMessages: threadMessages(documentRef, body), conversationId };
    context.thread = rewriteThreadContext(context); return context;
  }
  function composeMode(compose, subject = "") {
    const label = [compose?.getAttribute?.("aria-label"), compose?.querySelector?.("h2")?.textContent, subject].filter(Boolean).join(" ");
    if (/forward|\bfwd:/i.test(label) || compose?.querySelector?.('[aria-label="Type of response"] .mI')) return COMPOSE_MODES.FORWARD;
    if (/reply all/i.test(label) || compose?.querySelector?.('[aria-label="Type of response"] .mK')) return COMPOSE_MODES.REPLY_ALL;
    if (compose?.getAttribute?.("role") === "region" || /reply|\bre:/i.test(label) || compose?.querySelector?.('[aria-label="Type of response"] .mL')) return COMPOSE_MODES.REPLY;
    return COMPOSE_MODES.NEW_COMPOSE;
  }
  function composeAdapter(compose, documentRef = document) {
    const context = composeContext(compose, documentRef); const recipients = recipientAddresses(compose);
    return { root: compose, mode: composeMode(compose, context.subject), getBody: () => findBody(compose), getSubject: () => composeContext(compose, documentRef).subject, getSender: () => detectSender(compose), getRecipients: () => recipientAddresses(compose), getThreadContext: () => composeContext(compose, documentRef).thread, getToolbarAnchor: () => composeMount(compose), replaceDraft: (replacement) => replaceDraftBody(findBody(compose), replacement), restoreDraft: (snapshot) => restoreDraftBody(findBody(compose), snapshot), context, recipients };
  }
  function outboundContext(compose, documentRef = document) { const adapter = composeAdapter(compose, documentRef); const context = adapter.context; return { composeId: composeIdentity(compose), composeMode: adapter.mode, senderAddress: context.senderAddress, recipientAddresses: adapter.recipients, subject: context.subject, finalBody: context.draft, threadContext: core.limitThread(context.threadMessages.map((item) => item.text), { maxMessages: 6, maxChars: 20000 }), conversationRef: context.conversationId }; }
  function isSendControl(target, compose) { const control = target?.closest?.('[role="button"], button'); if (!control || !compose?.contains?.(control) || control.closest?.(".amm-voice-shell")) return false; const label = [control.getAttribute?.("aria-label"), control.getAttribute?.("data-tooltip"), textOf(control)].filter(Boolean).join(" ").trim(); return /^send(?:\s|$|\()/i.test(label) && !/^send\s+(later|options)/i.test(label) && !/more send options/i.test(label); }
  function dispatchInput(body, text, inputType) { body.dispatchEvent(new InputEvent("input", { bubbles: true, inputType, data: text })); }
  function replaceDraftBody(body, replacement) {
    if (!body) throw new Error("NO_DRAFT"); const snapshot = { html: body.innerHTML }; const protectedNode = body.querySelector(PROTECTED_SELECTOR); const range = document.createRange(); range.setStart(body, 0); if (protectedNode) range.setEndBefore(protectedNode); else range.selectNodeContents(body); range.deleteContents();
    const fragment = document.createDocumentFragment(); String(replacement).split("\n").forEach((line, index) => { if (index) fragment.append(document.createElement("br")); fragment.append(document.createTextNode(line)); }); body.insertBefore(fragment, body.firstChild); body.focus(); dispatchInput(body, String(replacement), "insertReplacementText"); return snapshot;
  }
  function restoreDraftBody(body, snapshot) { if (!body || !snapshot) return false; body.innerHTML = snapshot.html; body.focus(); dispatchInput(body, null, "historyUndo"); return true; }
  return { BODY_SELECTOR, PROTECTED_SELECTOR, COMPOSE_BOUNDARY_SELECTOR, COMPOSE_MODES, textOf, findBody, isComposeBody, hasSendControl, composeRootForBody, composeRootForNode, findComposeRoots, composeMount, composeIdentity, ensureComposeIdentity, draftText, detectSender, recipientAddresses, recipientAddress, rewriteThreadContext, composeMode, composeAdapter, composeContext, outboundContext, isSendControl, replaceDraftBody, restoreDraftBody };
});
