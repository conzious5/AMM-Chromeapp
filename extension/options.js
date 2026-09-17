const DEFAULT_BACKEND = "https://ammserver-production.up.railway.app";
const LOCAL_BACKEND = "http://localhost:3000";
const fields = {
  backend: document.querySelector("#backend"), environment: document.querySelector("#environment"), defaultAction: document.querySelector("#default-action"),
  email: document.querySelector("#email"), password: document.querySelector("#password"), showReview: document.querySelector("#show-review"), autoSender: document.querySelector("#auto-sender"), developmentMode: document.querySelector("#development-mode"), coachingPolicy: document.querySelector("#coaching-policy"), status: document.querySelector("#status"),
  diagnosticExtensionId: document.querySelector("#diagnostic-extension-id"), diagnosticAccess: document.querySelector("#diagnostic-access"), diagnosticRefresh: document.querySelector("#diagnostic-refresh"), diagnosticUser: document.querySelector("#diagnostic-user"), diagnosticRestored: document.querySelector("#diagnostic-restored"), diagnosticRequest: document.querySelector("#diagnostic-request")
};
function showCoachingPolicy(config) { fields.coachingPolicy.textContent = config?.emailCoachingEnabled === true ? "Enabled by Authentic Moments for newly sent email from your authorized business addresses." : "Not currently enabled for this account."; }
async function send(message) { const response = await chrome.runtime.sendMessage(message); if (!response?.ok) { const details = response?.error; const error = new Error(typeof details === "object" ? details.message : details || "Request failed."); if (details && typeof details === "object") { error.code = details.code; error.status = details.status; } throw error; } return response.result; }
function yesNo(value) { return value ? "Yes" : "No"; }
function showDiagnostics(value) {
  fields.diagnosticExtensionId.textContent = value?.extensionInstanceId || chrome.runtime.id; fields.diagnosticAccess.textContent = yesNo(value?.accessTokenPresent); fields.diagnosticRefresh.textContent = yesNo(value?.refreshTokenPresent); fields.diagnosticUser.textContent = yesNo(value?.currentUserPresent); fields.diagnosticRestored.textContent = yesNo(value?.authRestored); fields.diagnosticRequest.textContent = String(value?.lastProtectedRequestStatus ?? "none");
}
async function refreshDiagnostics() { const value = await send({ type: "GET_AUTH_STATUS" }); showDiagnostics(value); return value; }
function environmentChanged() { const local = fields.environment.value === "local"; document.querySelectorAll(".development-only").forEach((node) => { node.hidden = !local; }); if (document.activeElement === fields.environment) fields.backend.value = local ? LOCAL_BACKEND : DEFAULT_BACKEND; if (!local) fields.developmentMode.checked = false; }
async function load() {
  const value = await chrome.storage.local.get(["backendUrl", "backendEnvironment", "defaultAction", "showZacReview", "autoDetectSender", "developmentMode"]);
  fields.environment.value = value.backendEnvironment || "production"; fields.backend.value = value.backendUrl || (fields.environment.value === "local" ? LOCAL_BACKEND : DEFAULT_BACKEND); fields.defaultAction.value = value.defaultAction || "amm_style"; fields.showReview.checked = value.showZacReview !== false; fields.autoSender.checked = value.autoDetectSender !== false; fields.developmentMode.checked = Boolean(value.developmentMode); environmentChanged();
  const status = await send({ type: "GET_AUTH_STATUS" }); showDiagnostics(status);
  if (status.authenticated) { try { const config = await send({ type: "GET_CONFIG" }); showCoachingPolicy(config); fields.status.textContent = `Signed in as ${config.authenticatedUser}.`; } catch { fields.status.textContent = "AMM Voice could not verify the current session."; } }
  else { fields.coachingPolicy.textContent = "Sign in to view the current coaching policy."; fields.status.textContent = "Signed out. Sign in to use AMM Voice."; }
}
async function save() {
  const backendUrl = fields.backend.value.trim().replace(/\/$/, ""); const local = /^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(backendUrl);
  if (!/^https?:\/\//i.test(backendUrl)) throw new Error("Enter a valid backend URL."); if (fields.developmentMode.checked && !local) throw new Error("Mock authentication is allowed only with a localhost backend.");
  await chrome.storage.local.set({ backendUrl, backendEnvironment: fields.environment.value, defaultAction: fields.defaultAction.value, showZacReview: fields.showReview.checked, autoDetectSender: fields.autoSender.checked, developmentMode: fields.developmentMode.checked }); fields.status.textContent = "Settings saved.";
}
fields.environment.addEventListener("change", environmentChanged);
document.querySelector("#save").addEventListener("click", () => save().catch((error) => { fields.status.textContent = error.message; }));
document.querySelector("#signin").addEventListener("click", async () => { let password = ""; try { await save(); fields.status.textContent = "Signing in…"; password = fields.password.value; fields.password.value = ""; const config = await send({ type: "SIGN_IN", email: fields.email.value, password }); showCoachingPolicy(config); showDiagnostics(config.authStatus); fields.status.textContent = `Signed in as ${config.authenticatedUser}. Authorized From addresses: ${(config.senderAddresses || []).join(", ") || "none"}.`; } catch (error) { fields.status.textContent = error.message; await refreshDiagnostics().catch(() => {}); } finally { password = ""; fields.password.value = ""; } });
document.querySelector("#signout").addEventListener("click", async () => { try { await send({ type: "SIGN_OUT" }); fields.coachingPolicy.textContent = "Sign in to view the current coaching policy."; fields.status.textContent = "Signed out."; await refreshDiagnostics(); } catch (error) { fields.status.textContent = error.message; } });
document.querySelector("#refresh-diagnostics").addEventListener("click", async () => { fields.diagnosticRequest.textContent = "Refreshing…"; try { await refreshDiagnostics(); } catch { fields.diagnosticRequest.textContent = "Unavailable"; } });
console.info("[AMM Voice diagnostics]", { extension_instance_id: chrome.runtime.id, context: "options" });
load().catch((error) => { fields.status.textContent = error.message; });
