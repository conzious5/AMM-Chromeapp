# AMM Voice Chrome extension

Manifest V3 Gmail writing assistant with two explicit actions:

- **AMM Style** polishes the current draft for warmth, clarity, professionalism, gratitude, and readability while preserving facts and intent.
- **Zac's Edit** performs a deeper client-service review for unanswered questions, hidden concerns, promises, ambiguity, contradictions, missing explanation, and missing next steps.

The extension never sends email, never touches recipient or subject fields during replacement, and contains no OpenAI key or Railway secret.

## Compose experience

Every Gmail compose window gets its own AMM Voice toolbar and state. Multiple compose windows can use different senders, modes, results, and Undo histories without sharing data.

The inline panel supports:

- Suggested response
- Replace Draft
- Try Again
- Undo
- Cancel
- Calm fact-preservation warnings
- Meaningful Zac Review findings
- Question-coverage review when multiple or unresolved questions make it useful
- Loading, timeout, network, authentication, sender, rate-limit, model, and API error states

Draft replacement preserves Gmail signatures and quoted history by replacing only content before protected Gmail nodes. An immediate HTML snapshot supports Undo.

## Sender behavior

AMM Voice attempts to read the current Gmail From address for new compose, reply, reply-all, and forward windows. The detected address is used only when it is present in the backend-authorized sender list. If detection is missing, disabled, or unauthorized, the panel displays a selector containing only backend-authorized identities. It never guesses.

## Context and privacy

- At most the six most recent visible Gmail message bodies are considered.
- Thread context is capped at 20,000 characters.
- Expensive work runs only after an explicit AMM Style or Zac's Edit click.
- Drafts and complete threads are not written to extension storage or telemetry.
- Telemetry is behind an interface and accepts only conceptual event names plus allowlisted scalar metadata.

## Auth and API boundaries

`ExtensionAuthProvider` exposes `signIn`, `signOut`, `getAccessToken`, and `getCurrentUser`. `BackendExtensionAuthProvider` adapts the existing backend flow without making it a UI dependency. `DevelopmentAuthProvider` supplies a local mock only when the backend is `localhost` or `127.0.0.1`.

`ExtensionApiClient` centralizes current-user/configuration, authorized-sender, rewrite, retry, and future feedback operations. The canonical auth and feedback adapters remain final-integration work.

## Unpacked installation

1. Configure the backend using `docs/extension-setup.md`.
2. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select this `extension` directory.
4. Open the extension settings, confirm the backend environment/URL, and sign in.
5. Reload Gmail and open one or more compose windows.

## Local testability

Run dependency-free automated tests:

```bash
node --test extension/tests/*.test.cjs
```

Run JavaScript and manifest syntax checks:

```bash
for f in extension/*.js; do node --check "$f"; done
node -e 'JSON.parse(require("fs").readFileSync("extension/manifest.json", "utf8"))'
```

Open `extension/dev-harness.html` directly in a browser for a backend-free two-compose interaction check. Verify:

1. AMM Style in Compose A and Zac's Edit in Compose B remain independent.
2. Compose B shows the authorized sender fallback.
3. Zac's Edit shows review notes, warnings, and question coverage.
4. Replace Draft leaves the signature in place.
5. Undo restores the exact pre-replacement HTML.
6. Escape closes the active panel and returns focus to its action.
7. No AMM Voice action triggers Gmail Send.

## Gmail DOM assumptions

Gmail has no stable public DOM contract. The adapter currently relies on compose dialogs, a contenteditable textbox, the compose toolbar, common From-address attributes, `.a3s.aiL` message bodies, `.gmail_signature`, and `.gmail_quote`. Unknown From layouts fail closed to the authorized selector. These selectors require a real-Gmail regression pass before store distribution.

## Chrome Web Store preparation

Before packaging:

- complete real Gmail tests across new compose, reply, reply all, forward, changed From, shared sender, collapsed From, and multiple windows;
- finalize the canonical native auth adapter and remove any obsolete auth flow code;
- stabilize the extension ID and production redirect configuration;
- replace broad assumptions with selector fixtures captured from supported Gmail layouts;
- add icons/store artwork, a privacy disclosure, permission rationale, support information, and release signing;
- verify no development mode or mock configuration is enabled in the release package.
