# Chrome extension setup

## Authentication and backend configuration

The extension signs in to the same Railway backend with the user’s AMM Voice email and password. It does not use Google OAuth, contain a permanent backend secret, or retain the plaintext password.

After login, the backend issues a 15-minute opaque access token and a revocable, rotating refresh token. Both are stored in `chrome.storage.session`, so they are cleared when the browser session ends. Production sender permissions are loaded from PostgreSQL and enforced on every rewrite request.

Set `ALLOWED_ORIGINS` on Railway to the installed extension origin, for example:

```text
ALLOWED_ORIGINS=chrome-extension://<id shown by chrome://extensions>
```

## Developer/unpacked installation

1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select the repository's `extension` directory.
3. Add the displayed extension origin to Railway `ALLOWED_ORIGINS`, then redeploy.
4. Open extension options, enter the backend origin, and sign in with the employee’s AMM Voice email and password.
5. Reload Gmail. Every compose window receives an **AMM Voice** button.

The extension attempts to detect Gmail's active From address. If Gmail does not expose it reliably, the user chooses from backend-authorized addresses. Changing that sender never changes the authenticated employee. Cylina may use `cylina@authentic-moments.com` or `hello@authentic-moments.com`; the latter is not a user account.

## Distribution path

The extension is standard Manifest V3 and can later be packaged for the Chrome Web Store or deployed through managed-browser policies. Employee authorization and sender permissions remain backend configuration, so the extension bundle is identical for every employee.

## Future Workspace Add-on

The MVP does not include a Gmail Workspace Add-on. The extension owns only Gmail DOM/context extraction and preview interaction; rewrite logic, authentication policy, voice profiles, sender authorization, Zac's Edit, and analytics remain reusable backend services.
