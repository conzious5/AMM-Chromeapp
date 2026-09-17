const DEFAULT_BACKEND="https://ammserver-production.up.railway.app",backend=document.querySelector("#backend"),status=document.querySelector("#status");
async function send(type){const response=await chrome.runtime.sendMessage({type});if(!response?.ok)throw new Error(response?.error||"Request failed.");return response.result}
chrome.storage.local.get("backendUrl").then(value=>{backend.value=value.backendUrl||DEFAULT_BACKEND});
document.querySelector("#save").addEventListener("click",async()=>{await chrome.storage.local.set({backendUrl:backend.value.replace(/\/$/,"")});status.textContent="Backend saved."});
document.querySelector("#signin").addEventListener("click",async()=>{try{await chrome.storage.local.set({backendUrl:backend.value.replace(/\/$/,"")});const config=await send("SIGN_IN");status.textContent=`Signed in as ${config.authenticatedUser}. Allowed From addresses: ${config.senderAddresses.join(", ")}`}catch(error){status.textContent=error.message}});
document.querySelector("#signout").addEventListener("click",async()=>{await send("SIGN_OUT");status.textContent="Signed out."});
