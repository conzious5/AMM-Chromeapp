# Chrome extension setup

## Backend configuration

Set the individual employee allowlist and sender permissions on Railway:

```text
TEAM_EMAILS=cylina@authentic-moments.com
USER_SENDER_PERMISSIONS_JSON={"cylina@authentic-moments.com":["cylina@authentic-moments.com","hello@authentic-moments.com"]}
EXTENSION_IDS=<id shown by chrome://extensions>
```

Register `https://<backend>/auth/extension/callback` as an authorized Google OAuth redirect URI. `EXTENSION_IDS` protects the final redirect back to `https://<extension-id>.chromiumapp.org/callback`.

## Developer/unpacked installation

1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select the repository's `extension` directory.
3. Copy the displayed extension ID into `EXTENSION_IDS` and restart/redeploy the backend.
4. Open the extension options, enter the backend origin, and sign in with the employee's individual company Google account.
5. Reload Gmail. Every compose window receives an **AMM Voice** button.

The extension attempts to detect Gmail's active From address. If Gmail does not expose it reliably, the user chooses from the backend-authorized addresses. Changing that sender never changes the authenticated employee.

## Distribution path

The extension is standard Manifest V3 and can later be packaged for the Chrome Web Store or deployed through Google Workspace managed-browser policies. Employee authorization and sender permissions remain backend configuration, so the extension bundle is identical for every employee.

## Future Workspace Add-on

The MVP does not include a Gmail Workspace Add-on. The extension owns only Gmail DOM/context extraction and preview interaction; rewrite logic, authentication policy, voice profiles, sender authorization, Zac's Edit, and analytics remain reusable backend services.
