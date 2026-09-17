function textOf(element) { return element?.innerText?.trim() || element?.textContent?.trim() || ""; }
function composeContext(compose) {
  const body = compose.querySelector('[contenteditable="true"][role="textbox"]'); const subject = compose.querySelector('input[name="subjectbox"]');
  const recipient = compose.querySelector('[email][data-hovercard-id], [email]')?.getAttribute("email") || compose.querySelector('input[role="combobox"]')?.value || "";
  const fromNode = compose.querySelector('input[name="from"], [data-tooltip^="From:"], [aria-label^="From"]');
  const fromText = fromNode?.value || fromNode?.getAttribute?.("email") || fromNode?.getAttribute?.("data-tooltip") || fromNode?.getAttribute?.("aria-label") || textOf(fromNode);
  const senderAddress = fromText?.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0]?.toLowerCase() || "";
  const thread = [...document.querySelectorAll(".a3s.aiL")].slice(-6).map(textOf).filter(Boolean).join("\n\n---\n\n").slice(-30000);
  const conversationId = location.hash.match(/[a-f0-9]{16,}/i)?.[0] || compose.getAttribute("data-thread-perm-id") || "";
  return { body, subject: subject?.value || "", draft: textOf(body), recipientAddress: recipient, senderAddress, thread, conversationId };
}
async function call(type, payload) { const response = await chrome.runtime.sendMessage({ type, payload }); if (!response?.ok) throw new Error(response?.error || "AMM Voice request failed."); return response.result; }
async function chooseSender(detected, allowed) {
  if (detected && allowed.includes(detected)) return detected; if (allowed.length === 1) return allowed[0];
  const choice = prompt(`Select the Gmail From address:\n${allowed.join("\n")}`, detected || allowed[0] || "");
  if (!choice || !allowed.includes(choice.toLowerCase())) throw new Error("Choose a permitted sender address."); return choice.toLowerCase();
}
async function rewrite(compose, button) {
  const context = composeContext(compose); if (!context.body || !context.draft) throw new Error("Write or open a draft before using AMM Voice."); button.disabled = true; button.textContent = "Reviewing…";
  try {
    let config; try { config = await call("GET_CONFIG"); } catch (error) { if (error.message !== "SIGN_IN_REQUIRED") throw error; config = await call("SIGN_IN"); }
    const senderAddress = await chooseSender(context.senderAddress, config.senderAddresses || []); const mode = confirm("Choose OK for Zac's Edit, or Cancel for AMM Style.") ? "zacs_edit" : "amm_style";
    const payload = { mode, draft: context.draft, subject: context.subject, thread: context.thread, senderAddress };
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(context.recipientAddress)) payload.recipientAddress = context.recipientAddress; if (context.conversationId) payload.conversationId = context.conversationId;
    const result = await call("REWRITE", payload); const notes = [...(result.reviewNotes || []), ...(result.warnings || [])].join("\n• ");
    if (confirm(`${result.rewrittenText}\n\n${notes ? `Review notes:\n• ${notes}\n\n` : ""}Replace the current draft?`)) {
      context.body.focus(); document.execCommand("selectAll", false); document.execCommand("insertText", false, result.rewrittenText); context.body.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: result.rewrittenText }));
    }
  } finally { button.disabled = false; button.textContent = "AMM Voice"; }
}
function enhance(compose) { if (compose.querySelector(".amm-voice-button") || !compose.querySelector('[contenteditable="true"][role="textbox"]')) return; const toolbar = compose.querySelector('[role="toolbar"]'); if (!toolbar) return; const button = document.createElement("button"); button.type = "button"; button.className = "amm-voice-button"; button.textContent = "AMM Voice"; button.addEventListener("click", () => rewrite(compose, button).catch((error) => alert(error.message))); toolbar.prepend(button); }
function scan() { document.querySelectorAll('[role="dialog"]').forEach(enhance); } new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true }); scan();
