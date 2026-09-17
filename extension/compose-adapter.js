(function (root, factory) {
  const api = factory(root.AMMVoiceCore || (typeof require === "function" ? require("./core.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AMMVoiceCompose = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (core) {
  "use strict";
  const BODY_SELECTOR = '[contenteditable="true"][role="textbox"]'; const PROTECTED_SELECTOR = ".gmail_signature, .gmail_quote, [data-smartmail=\"gmail_signature\"]";
  function textOf(element) { return element?.innerText?.trim() || element?.textContent?.trim() || ""; }
  function findBody(compose) {
    const candidates = [...(compose?.querySelectorAll?.(BODY_SELECTOR) || [])];
    return candidates.find((node) => node.getAttribute?.("g_editable") === "true") || candidates.find((node) => !/describe your message/i.test(node.getAttribute?.("aria-label") || "")) || null;
  }
  function composeMount(compose) {
    const sendButton = compose?.querySelector?.('[role="button"][aria-label="Send"], [role="button"][data-tooltip^="Send"]'); const sendTable = sendButton?.closest?.("table");
    if (sendTable?.parentElement) return { parent: sendTable.parentElement, before: sendTable };
    const toolbars = [...(compose?.querySelectorAll?.('[role="toolbar"]') || [])]; const toolbar = toolbars.find((node) => node.parentElement && (node.parentElement.offsetWidth || node.parentElement.offsetHeight)) || toolbars[0];
    return { parent: toolbar?.parentElement || compose, before: null };
  }
  function composeIdentity(compose) { return compose?.getAttribute?.("data-thread-perm-id") || compose?.getAttribute?.("aria-labelledby") || ""; }
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
  function threadMessages(documentRef, body) { const nodes = [...documentRef.querySelectorAll(".a3s.aiL, [data-message-id] .a3s")]; return nodes.filter((node) => node !== body && !body?.contains?.(node) && !node.contains?.(body)).map(textOf); }
  function composeContext(compose, documentRef = document) {
    const body = findBody(compose); const subject = compose.querySelector('input[name="subjectbox"]')?.value || documentRef.querySelector("h2.hP")?.textContent?.trim() || "";
    const hash = documentRef?.location?.hash || (typeof location !== "undefined" ? location.hash : ""); const conversationId = hash.match(/[a-f0-9]{16,}/i)?.[0] || compose.getAttribute("data-thread-perm-id") || "";
    return { body, subject, draft: draftText(body), recipientAddress: recipientAddress(compose), senderAddress: detectSender(compose), thread: core.limitThread(threadMessages(documentRef, body), { maxMessages: 6, maxChars: 20000 }), conversationId };
  }
  function composeMode(compose, subject = "") { const label = [compose?.getAttribute?.("aria-label"), compose?.querySelector?.("h2")?.textContent, subject].filter(Boolean).join(" "); if (/reply all/i.test(label)) return "reply_all"; if (/forward|\bfwd:/i.test(label)) return "forward"; if (/reply|\bre:/i.test(label)) return "reply"; return "new_compose"; }
  function outboundContext(compose, documentRef = document) { const context = composeContext(compose, documentRef); return { composeId: composeIdentity(compose), composeMode: composeMode(compose, context.subject), senderAddress: context.senderAddress, recipientAddresses: recipientAddresses(compose), subject: context.subject, finalBody: context.draft, threadContext: context.thread, conversationRef: context.conversationId }; }
  function isSendControl(target, compose) { const control = target?.closest?.('[role="button"], button'); if (!control || !compose?.contains?.(control) || control.closest?.(".amm-voice-shell")) return false; const label = [control.getAttribute?.("aria-label"), control.getAttribute?.("data-tooltip"), textOf(control)].filter(Boolean).join(" ").trim(); return /^send(?:\s|$|\()/i.test(label) && !/^send\s+(later|options)/i.test(label) && !/more send options/i.test(label); }
  function dispatchInput(body, text, inputType) { body.dispatchEvent(new InputEvent("input", { bubbles: true, inputType, data: text })); }
  function replaceDraftBody(body, replacement) {
    if (!body) throw new Error("NO_DRAFT"); const snapshot = { html: body.innerHTML }; const protectedNode = body.querySelector(PROTECTED_SELECTOR); const range = document.createRange(); range.setStart(body, 0); if (protectedNode) range.setEndBefore(protectedNode); else range.selectNodeContents(body); range.deleteContents();
    const fragment = document.createDocumentFragment(); String(replacement).split("\n").forEach((line, index) => { if (index) fragment.append(document.createElement("br")); fragment.append(document.createTextNode(line)); }); body.insertBefore(fragment, body.firstChild); body.focus(); dispatchInput(body, String(replacement), "insertReplacementText"); return snapshot;
  }
  function restoreDraftBody(body, snapshot) { if (!body || !snapshot) return false; body.innerHTML = snapshot.html; body.focus(); dispatchInput(body, null, "historyUndo"); return true; }
  return { BODY_SELECTOR, PROTECTED_SELECTOR, textOf, findBody, composeMount, composeIdentity, draftText, detectSender, recipientAddresses, recipientAddress, composeMode, composeContext, outboundContext, isSendControl, replaceDraftBody, restoreDraftBody };
});
