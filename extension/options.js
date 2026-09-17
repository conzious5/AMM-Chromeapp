const DEFAULT_BACKEND = "https://ammserver-production.up.railway.app";
const LOCAL_BACKEND = "http://localhost:3000";
const fields = {
  backend: document.querySelector("#backend"), environment: document.querySelector("#environment"), defaultAction: document.querySelector("#default-action"),
  email: document.querySelector("#email"), password: document.querySelector("#password"), showReview: document.querySelector("#show-review"), autoSender: document.querySelector("#auto-sender"), developmentMode: document.querySelector("#development-mode"), status: document.querySelector("#status")
};
async function send(message) { const response = await chrome.runtime.sendMessage(message); if (!response?.ok) throw new Error(response?.error || "Request failed."); return response.result; }
function environmentChanged() { const local = fields.environment.value === "local"; document.querySelectorAll(".development-only").forEach((node) => { node.hidden = !local; }); if (document.activeElement === fields.environment) fields.backend.value = local ? LOCAL_BACKEND : DEFAULT_BACKEND; if (!local) fields.developmentMode.checked = false; }
async function load() {
  const value = await chrome.storage.local.get(["backendUrl", "backendEnvironment", "defaultAction", "showZacReview", "autoDetectSender", "developmentMode"]);
  fields.environment.value = value.backendEnvironment || "production"; fields.backend.value = value.backendUrl || (fields.environment.value === "local" ? LOCAL_BACKEND : DEFAULT_BACKEND); fields.defaultAction.value = value.defaultAction || "amm_style"; fields.showReview.checked = value.showZacReview !== false; fields.autoSender.checked = value.autoDetectSender !== false; fields.developmentMode.checked = Boolean(value.developmentMode); environmentChanged();
}
async function save() {
  const backendUrl = fields.backend.value.trim().replace(/\/$/, ""); const local = /^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(backendUrl);
  if (!/^https?:\/\//i.test(backendUrl)) throw new Error("Enter a valid backend URL."); if (fields.developmentMode.checked && !local) throw new Error("Mock authentication is allowed only with a localhost backend.");
  await chrome.storage.local.set({ backendUrl, backendEnvironment: fields.environment.value, defaultAction: fields.defaultAction.value, showZacReview: fields.showReview.checked, autoDetectSender: fields.autoSender.checked, developmentMode: fields.developmentMode.checked }); fields.status.textContent = "Settings saved.";
}
fields.environment.addEventListener("change", environmentChanged);
document.querySelector("#save").addEventListener("click", () => save().catch((error) => { fields.status.textContent = error.message; }));
document.querySelector("#signin").addEventListener("click", async () => { let password = ""; try { await save(); fields.status.textContent = "Signing in…"; password = fields.password.value; fields.password.value = ""; const config = await send({ type: "SIGN_IN", email: fields.email.value, password }); fields.status.textContent = `Signed in as ${config.authenticatedUser}. Authorized From addresses: ${(config.senderAddresses || []).join(", ") || "none"}.`; } catch (error) { fields.status.textContent = error.message; } finally { password = ""; fields.password.value = ""; } });
document.querySelector("#signout").addEventListener("click", async () => { try { await send({ type: "SIGN_OUT" }); fields.status.textContent = "Signed out."; } catch (error) { fields.status.textContent = error.message; } });
load().catch((error) => { fields.status.textContent = error.message; });
