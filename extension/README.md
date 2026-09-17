# AMM Voice Chrome extension

Manifest V3 Gmail MVP. The extension is a thin client: it detects compose context, asks the authenticated backend for permitted sender addresses, requests a rewrite, previews the result, and replaces the draft only after explicit confirmation. It never sends email and contains no OpenAI key.

## Unpacked installation

1. Configure the backend using `docs/extension-setup.md`.
2. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select this `extension` directory.
4. Open the extension's options page, confirm the backend URL, and select **Sign in with Google**.
5. Reload Gmail.

Employee identity comes from Google authentication. The Gmail From address is detected separately and validated against backend-provided sender permissions.
