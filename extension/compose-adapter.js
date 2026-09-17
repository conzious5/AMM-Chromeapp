(function (root, factory) {
  const api = factory(root.AMMVoiceCore || (typeof require === "function" ? require("./core.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AMMVoiceCompose = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (core) {
  "use strict";
  const BODY_SELECTOR = '[contenteditable="true"][role="textbox"]'; const PROTECTED_SELECTOR = ".gmail_signature, .gmail_quote, [data-smartmail=\"gmail_signature\"]";
  function textOf(element) { return element?.innerText?.trim() || element?.textContent?.trim() || ""; }
  function findBody(compose) { return compose?.querySelector?.(BODY_SELECTOR) || null; }
  function draftText(body) { if (!body) return ""; const copy = body.cloneNode(true); copy.querySelectorAll?.(PROTECTED_SELECTOR).forEach((node) => node.remove()); return textOf(copy); }
  function detectSender(compose) {
    const selectors = ['input[name="from"]', '[name="from"] [email]', '[data-tooltip^="From:"]', '[aria-label^="From:"]', '[aria-label^="From "]', '[data-hovercard-id*="@"]'];
    for (const selector of selectors) { const node = compose.querySelector(selector); const candidate = node?.value || node?.getAttribute?.("email") || node?.getAttribute?.("data-hovercard-id") || node?.getAttribute?.("data-tooltip") || node?.getAttribute?.("aria-label") || textOf(node); const email = core.normalizeEmail(candidate); if (email) return email; }
    return "";
  }
  function recipientAddress(compose) { const node = compose.querySelector('[email][data-hovercard-id], [email], input[role="combobox"]'); return core.normalizeEmail(node?.getAttribute?.("email") || node?.value || textOf(node)); }
  function threadMessages(documentRef, body) { const nodes = [...documentRef.querySelectorAll(".a3s.aiL, [data-message-id] .a3s")]; return nodes.filter((node) => node !== body && !body?.contains?.(node) && !node.contains?.(body)).map(textOf); }
  function composeContext(compose, documentRef = document) {
    const body = findBody(compose); const subject = compose.querySelector('input[name="subjectbox"]')?.value || documentRef.querySelector("h2.hP")?.textContent?.trim() || "";
    const conversationId = location.hash.match(/[a-f0-9]{16,}/i)?.[0] || compose.getAttribute("data-thread-perm-id") || "";
    return { body, subject, draft: draftText(body), recipientAddress: recipientAddress(compose), senderAddress: detectSender(compose), thread: core.limitThread(threadMessages(documentRef, body), { maxMessages: 6, maxChars: 20000 }), conversationId };
  }
  function dispatchInput(body, text, inputType) { body.dispatchEvent(new InputEvent("input", { bubbles: true, inputType, data: text })); }
  function replaceDraftBody(body, replacement) {
    if (!body) throw new Error("NO_DRAFT"); const snapshot = { html: body.innerHTML }; const protectedNode = body.querySelector(PROTECTED_SELECTOR); const range = document.createRange(); range.setStart(body, 0); if (protectedNode) range.setEndBefore(protectedNode); else range.selectNodeContents(body); range.deleteContents();
    const fragment = document.createDocumentFragment(); String(replacement).split("\n").forEach((line, index) => { if (index) fragment.append(document.createElement("br")); fragment.append(document.createTextNode(line)); }); body.insertBefore(fragment, body.firstChild); body.focus(); dispatchInput(body, String(replacement), "insertReplacementText"); return snapshot;
  }
  function restoreDraftBody(body, snapshot) { if (!body || !snapshot) return false; body.innerHTML = snapshot.html; body.focus(); dispatchInput(body, null, "historyUndo"); return true; }
  return { BODY_SELECTOR, PROTECTED_SELECTOR, textOf, findBody, draftText, detectSender, recipientAddress, composeContext, replaceDraftBody, restoreDraftBody };
});
