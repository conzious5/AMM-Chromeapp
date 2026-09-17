# Install the AMM Voice beta in Chrome

AMM Voice Beta v0.1.3 is an unpacked Chrome extension. It does not require Node, npm, pnpm, Git, or terminal access.

## Install

1. Download `AMM-Voice-Beta-v0.1.3.zip`.
2. Unzip it.
3. Move the resulting `amm-voice-extension` folder somewhere permanent. Chrome must be able to find the same folder after installation and updates.
4. Open Chrome.
5. Visit `chrome://extensions`.
6. Enable **Developer mode**.
7. Click **Load unpacked**.
8. Select the `amm-voice-extension` folder that directly contains `manifest.json`.
9. Confirm **AMM Voice** appears in the extension list.
10. Pin AMM Voice from Chrome's Extensions menu if desired.
11. Open the AMM Voice settings page from its extension icon.
12. Keep **Production** selected and confirm the backend is `https://ammserver-production.up.railway.app`.
13. Sign in with the individual AMM Voice account `cylina@authentic-moments.com`. Do not use `hello@authentic-moments.com` to sign in; it is an authorized Gmail From address, not a user account.
14. Open Gmail and reload the Gmail tab once after first installation.
15. Open a New Compose, Reply, Reply All, and Forward editor and confirm **AMM Style** and **Zac's Edit** appear in each.

AMM Voice never clicks Gmail's Send button. Review every suggestion and use **Replace Draft** only when you want to update the current draft.

## Login persistence

The beta stores its opaque access token, rotating refresh token, and public current-user information in `chrome.storage.session`. It never stores the password.

- Closing Gmail does not sign you out.
- Closing a Gmail tab does not sign you out.
- Closing and reopening Chrome ends the extension session, so you must sign in again.
- Rebooting the computer ends the extension session, so you must sign in again.

This is deliberately conservative for the first beta. A future daily-use release may keep only the rotating refresh token in `chrome.storage.local`, keep the short-lived access token in session storage, and revoke/clear both on logout. That change should be made only after production device-loss and token-revocation behavior is approved.

## Beta updates

1. Download the new beta ZIP.
2. Remove the prior beta from `chrome://extensions` so its service worker and session state cannot remain active.
3. Unzip v0.1.3 into the same permanent parent location used for AMM Voice testing.
4. In `chrome://extensions`, enable Developer mode and choose **Load unpacked**.
5. Select the new `amm-voice-extension` folder containing `manifest.json`.
6. Sign in again, then reload all open Gmail tabs.

If Chrome reports that the extension folder is missing, remove the broken AMM Voice entry and repeat the installation steps using the new folder. A beta update may require another AMM Voice sign-in.

## Quick verification

1. Start a new Gmail compose window.
2. Enter a short test draft without confidential client details.
3. Click **AMM Style** and confirm a suggestion appears without changing the draft automatically.
4. Click **Cancel**, then click **Zac's Edit** and confirm meaningful review notes appear when the draft contains a real client-service concern.
5. Confirm the From-address selector offers only `cylina@authentic-moments.com` and `hello@authentic-moments.com` when automatic detection is unavailable.
6. While a review panel is open, use a normal Gmail action that refreshes the compose controls (for example, reveal/hide formatting or recipient controls). Confirm AMM Style and Zac's Edit remain present or promptly reappear without changing the draft, sender, or review.
7. Repeat the draft, Replace Draft, and Undo checks in Reply, Reply All, and Forward. Confirm recipients, signatures, quoted history, and forwarded content remain unchanged.

If sign-in fails, the buttons do not appear after reloading Gmail, or an authorized From address is missing, stop and contact Zac rather than entering credentials anywhere else.
