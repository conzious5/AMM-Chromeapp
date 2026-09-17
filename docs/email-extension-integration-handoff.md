# Email extension and identity-context handoff

## Extension experience continuation — `feature/extension-experience`

Implementation commits: `657c95f` (domain adapters, tests, and fixtures) and `6eb8e9e` (accessible multi-compose UI, settings, and harness). This branch is isolated from active canonical auth/Prisma reconciliation and modifies only extension assets, extension tests/fixtures, and extension documentation.

### What works now

- Two distinct compose actions: AMM Style and Zac's Edit.
- Compact inline compose panel with Suggested response, Replace Draft, Try Again, Undo, and Cancel.
- Meaningful Zac Review notes, calm backend warning display, and conditional client-question coverage.
- Independent `WeakMap`-backed state per Gmail compose window.
- From-address detection with fail-closed authorized sender selection.
- Six-message / 20,000-character thread context limits.
- Replacement limited to draft content before Gmail signature/quote nodes; exact immediate HTML snapshot for Undo.
- Explicit loading and recovery messages for auth, sender, draft, network, timeout, rate-limit, model, and API failures.
- Keyboard focus styles, ARIA labels/live regions, Escape dismissal, readable contrast, reduced-motion support, and responsive sizing.
- Settings for default action, Zac Review visibility, automatic sender detection, backend environment, and localhost-only mock authentication.
- `ExtensionAuthProvider`, `ExtensionApiClient`, and extension telemetry interfaces.
- Nineteen rewrite fixtures covering nine AMM Style and ten Zac's Edit scenarios.
- Dependency-free automated tests and a backend-free two-compose interaction harness.

### What is mocked

- `DevelopmentAuthProvider` and authorized senders, enabled only for localhost.
- `dev-harness.html` rewrite results, review notes, warnings, and configuration.
- Telemetry uses a no-op implementation; no competing analytics database or endpoint was added.
- `submitFeedback` exists at the API boundary but reports that canonical feedback wiring is unavailable.

### What awaits final auth/API integration

- Replace/adapt `BackendExtensionAuthProvider` when canonical native authentication lands.
- Confirm the final current-user/config and token-refresh contracts.
- Connect feedback/acceptance telemetry to the canonical service after event semantics are approved.
- Perform production Gmail tests against the final backend error/status envelope.

### Verification

- `node --test extension/tests/*.test.cjs`: 11 tests passed.
- All extension JavaScript passed `node --check`.
- Manifest and the 19-scenario fixture corpus parse as JSON.
- `extension/dev-harness.html` provides two independent compose windows for manual interaction verification. The in-app preview could not open a local file URL, so no screenshot was captured in this pass.

### New files

- `extension/core.js`
- `extension/compose-adapter.js`
- `extension/auth-provider.js`
- `extension/extension-api-client.js`
- `extension/telemetry.js`
- `extension/dev-harness.html`, `extension/dev-harness.js`
- `extension/fixtures/rewrite-scenarios.json`
- `extension/tests/core.test.cjs`, `extension/tests/adapters.test.cjs`

### Known Gmail limitations

- Gmail DOM selectors are undocumented and need real-account regression coverage.
- From detection intentionally falls back when Gmail hides or changes sender markup.
- Thread extraction uses recent visible message nodes and may require refinement for clipped messages, pop-out compose, unusual conversation layouts, or multiple open threads.
- Signature/quoted-content preservation covers common `.gmail_signature`, `.gmail_quote`, and smart-signature nodes; real Gmail fixture coverage is still needed.
- Question coverage is a lightweight local token-overlap signal for review, not a factual guarantee that the reply fully answers a question.

### Remaining dependencies

- Canonical extension auth adapter and native token/session behavior.
- Canonical API feedback/telemetry operations.
- Real Gmail matrix verification and selector fixtures.
- Stable production extension ID and distribution configuration.
- Chrome Web Store icons, listing materials, privacy/permission disclosure, signing, and release QA.

## What was built

- Chrome Manifest V3 Gmail extension for developer/unpacked installation.
- Compose-window AMM Voice action, draft/thread collection, best-effort From/recipient/conversation detection, mode selection, preview, and explicit draft replacement.
- Google OAuth extension flow through the Railway backend.
- Signed bearer-token authentication that identifies the human employee.
- Backend sender authorization independent of authentication.
- Rewrite and analytics context fields for sender, recipient, and conversation.
- Human/sender analytics grouping and portal display.
- Railway/Google/extension setup documentation.

The extension never sends email and contains no OpenAI API key.

## Branch

`main`

## Important commits

- `406c5a6` — Add secure management portal and extension authentication.
- `d6748a2` — Approve production dependency builds.

At handoff time, three small working-tree refinements are not included in `406c5a6`: README extension clarification, compose-dialog selector narrowing, and an additional sender-authorization route test. Inspect `git diff` before integration.

## Files added

- `extension/manifest.json`
- `extension/service-worker.js`
- `extension/content-script.js`
- `extension/content-style.css`
- `extension/options.html`
- `extension/options.js`
- `extension/options.css`
- `docs/extension-setup.md`
- `server/src/services/portalAuth.ts`
- `server/src/services/analyticsRepository.ts`
- `server/prisma/schema.prisma`
- `server/prisma/migrations/20260917000000_initial_portal/migration.sql`
- `server/prisma/migrations/20260917010000_identity_sender_split/migration.sql`
- `server/tests/identityContext.test.ts`
- Portal application files under `portal/`

## Shared files modified

- `.env.example`
- `.gitignore`
- `Dockerfile`
- `README.md`
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- `server/package.json`
- `server/src/app.ts`
- `server/src/config.ts`
- `server/src/index.ts`
- `server/src/schemas/rewrite.ts`
- `server/src/services/auth.ts`
- `server/tests/app.test.ts`
- `docs/architecture.md`
- `docs/security-and-privacy.md`
- `docs/portal-setup.md`

## Interfaces provided

### Authentication

`AuthPrincipal` contains stable ID, human email, optional name, and role. `SignedTokenAuth` validates extension tokens; `CompositeAuth` permits signed extension auth plus the local development token adapter.

### Rewrite context

`POST /api/rewrite` accepts optional `senderAddress`, `recipientAddress`, and `conversationId`. It rejects client-supplied `authenticatedUser` because the schema is strict and identity comes from authentication.

### Extension configuration

`GET /api/extension/config` returns:

```json
{
  "authenticatedUser": "cylina@authentic-moments.com",
  "name": "Cylina",
  "role": "TEAM",
  "senderAddresses": [
    "cylina@authentic-moments.com",
    "hello@authentic-moments.com"
  ]
}
```

### Analytics overview

`GET /api/portal/overview` accepts optional `authenticatedUser` and `senderAddress` query filters and returns `identityBreakdown` grouped by the pair.

## Database requirements

- PostgreSQL and Prisma.
- Apply both committed migrations in order using `prisma migrate deploy`.
- `AnalyticsEvent.authenticatedUser`, `senderAddress`, and `recipientAddress` are nullable for backward compatibility. New rewrite events populate the human identity.

## Authentication requirements

- Every employee signs in using an individual approved company Google account.
- `hello@authentic-moments.com` is a shared sender, not a login identity.
- Production extension OAuth requires the exact Chrome extension ID in `EXTENSION_IDS`.
- Sender use is denied unless listed for the authenticated employee in `USER_SENDER_PERMISSIONS_JSON`.

## Analytics requirements

- Preserve human and sender as independent dimensions.
- Do not log or persist full draft/thread bodies.
- Retain the opaque conversation reference only when available.
- Reports may aggregate by human, sender, or human+sender.

## Environment variables

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`
- `PUBLIC_BASE_URL`
- `ADMIN_EMAILS`
- `TEAM_EMAILS`
- `EXTENSION_IDS`
- `USER_SENDER_PERMISSIONS_JSON`
- `DATABASE_URL`
- `ALLOWED_ORIGINS`

## Routes

- `GET /auth/extension/start`
- `GET /auth/extension/callback`
- `GET /api/extension/config`
- `POST /api/rewrite`
- `GET /api/portal/overview`

Portal session routes are documented in `docs/portal-setup.md`.

## UI integration requirements

- Load `extension/` as an unpacked extension for MVP testing.
- The compose button must remain preview/replace only; never invoke Gmail Send.
- Gmail DOM selectors are best effort. If From detection fails, the UI requests a choice from backend-authorized sender addresses.
- Changing the Gmail From selection must trigger fresh context detection and must not trigger reauthentication.

## Known limitations

- Gmail DOM selectors are undocumented and may need maintenance.
- Current preview and mode/sender selection use native confirm/prompt dialogs; a production panel should replace them.
- The extension ID is not stable across unpacked installs unless Chrome preserves the installation or a manifest key/distribution package is used.
- Tokens are stored in `chrome.storage.local`; production hardening may move them to session storage/refresh flow.
- Sender permissions are currently environment-configured rather than database-administered.
- Only one recipient address is recorded even when Gmail contains multiple recipients.

## Assumptions

- Google OAuth web credentials can register the backend extension callback.
- The signed-token lifetime of eight hours is acceptable for the MVP.
- Backend configuration remains authoritative for employee and sender permission assignment.

## Tests

- Server TypeScript typecheck passes.
- Server Vitest suite passes: 10 tests at last run.
- Portal production build passes.
- Extension JavaScript syntax checks pass.
- `manifest.json` parses and declares Manifest V3.

## Potential merge conflicts

- `server/src/app.ts`
- `server/src/config.ts`
- `server/src/index.ts`
- `server/src/services/auth.ts`
- `server/src/services/analyticsRepository.ts`
- `server/prisma/schema.prisma` and migration ordering
- `portal/src/main.tsx`
- package manifests and lockfile
- Railway/Google setup documentation

Meeting Coach intentionally avoided these shared files; integration must use its ports rather than replacing current implementations.

## Remaining work

1. Configure production Google redirect URIs and Railway variables.
2. Stabilize the unpacked extension ID and add it to `EXTENSION_IDS`.
3. Apply migrations to the target database.
4. Perform a real Gmail end-to-end test with Cylina using both permitted From addresses.
5. Replace native dialogs with the approved extension UI.
6. Add acceptance/regeneration telemetry after UX is finalized.
7. Decide whether sender permissions move into a canonical user/permission database model.
8. Reconcile shared systems with Meeting Coach during final integration.
