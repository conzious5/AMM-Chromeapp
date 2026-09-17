# Email extension and identity-context handoff

## Extension experience continuation — `feature/extension-experience`

Implementation commits: `657c95f` (domain adapters, tests, and fixtures), `6eb8e9e` (accessible multi-compose UI, settings, and harness), `2ebc687` (extension-side adapter for canonical native auth `da95707`), `afc8f45` (meaningful-only Zac Review filtering), and `1b75312` (merge canonical native auth, harden beta behavior, package/install preparation). Initial handoff: `ae97860`.

### Beta validation continuation

- Merged canonical `main` through production-auth deployment documentation `e06498d`; shared server, Prisma, Railway, portal, and analytics implementations were accepted unchanged.
- Production health returned HTTP 200 and the native login UI rendered at `https://ammserver-production.up.railway.app`.
- A production extension-login request using an intentionally invalid password returned HTTP 401 with the safe generic error `Invalid email or password.`
- Extension auth/API tests now cover session-only token storage, no password persistence, exactly one refresh retry, refresh-token revocation, offline logout cleanup, malformed responses, and expired authentication.
- Beta runtime files are staged under `dist/amm-voice-extension/` and zipped as `dist/AMM-Voice-Beta-v0.1.0.zip`; generated artifacts are ignored by Git.
- Installation guide: `docs/CYLINA_EXTENSION_INSTALL.md`.
- **BETA BLOCKED:** Valid Cylina credentials were not available to this agent, and Chrome's protected extension-management page cannot be automated. A human must load the unpacked package, sign in privately, and leave the live Gmail test session ready before the new-compose/reply/reply-all/forward, both-sender, replace/undo, and failure matrix can be certified.

### What works on the feature branch

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
- `ExtensionAuthProvider`, `NativeExtensionAuthProvider`, `ExtensionApiClient`, and extension telemetry interfaces.
- Nineteen rewrite fixtures covering nine AMM Style and ten Zac's Edit scenarios.
- Dependency-free automated tests and a backend-free two-compose interaction harness.

### What is mocked or deferred

- `DevelopmentAuthProvider` and authorized senders are enabled only for localhost.
- `dev-harness.html` provides mock results, review notes, warnings, and configuration.
- Telemetry is a no-op; no competing analytics database or endpoint was added.
- `submitFeedback` exists at the API boundary but canonical feedback wiring is unavailable.
- Live Gmail new-compose inspection verified the `g_editable="true"` draft body, a visible `.aDh` panel mount, the subject field, and fail-closed From detection. Reply, reply-all, forward, changed From, and installed-extension behavior remain.

### Canonical native-auth compatibility

The extension provider targets `da95707`: email/password login, `chrome.storage.session` tokens, rotating refresh, logout, and current configuration. Passwords are passed only to the login request, cleared from the form before awaiting the server, and never stored. The manifest does not request Chrome identity. Valid-user deployment verification must still exercise login, refresh, revocation, and allowed-sender flow.

### Verification

- `node --test extension/tests/*.test.cjs`: 17 tests passed.
- All extension JavaScript passed `node --check`.
- Manifest and the 19-scenario fixture corpus parse as JSON.
- Static tests guard multiple-compose isolation, sender fallback, thread limits, question display, session-only auth behavior, draft extraction, privacy-safe telemetry, and absence of Gmail Send interaction.
- Chrome exercised `extension/dev-harness.html` through a localhost-only server: both compose windows retained independent AMM Style/Zac's Edit panels, sender fallback exposed only the two authorized fixture identities, replacement preserved the signature, and Undo restored the exact prior HTML.

### Known Gmail limitations

- Gmail selectors are undocumented. Live new-compose inspection on September 16, 2026 found an additional Gmail AI prompt textbox and hidden toolbar; body selection now prefers `g_editable="true"`, and panel mounting now uses the visible Send-row container without interacting with Send.
- From detection intentionally falls back when Gmail hides or changes sender markup.
- Recent visible message extraction may need refinement for clipped messages, pop-out compose, unusual layouts, or multiple open threads.
- Signature/quote preservation covers common `.gmail_signature`, `.gmail_quote`, and smart-signature nodes; real Gmail fixtures are still required.
- Question coverage is a lightweight local review signal, not a guarantee that a reply fully answers a question.

### Remaining integration dependencies

- Canonical native auth is merged through `e06498d`; resolved extension UI files preserve feature intent while server/auth/Prisma behavior remains canonical.
- Verify login, refresh rotation, logout/revocation, config, and sender authorization against the deployed backend.
- Run the real Gmail matrix: new compose, reply, reply all, forward, changed/collapsed From, shared sender, and multiple windows.
- Approve and connect canonical feedback/telemetry semantics.
- Prepare stable extension ID, CORS origin, store artwork/listing, permission/privacy disclosure, signing, and release QA.

## What was built

- Chrome Manifest V3 Gmail extension for developer/unpacked installation.
- Compose-window AMM Voice action, draft/thread collection, best-effort From/recipient/conversation detection, mode selection, preview, and explicit draft replacement.
- Native AMM Voice email/password login against the existing Railway backend; no Google OAuth or `identity` permission.
- A 15-minute opaque access token plus rotating, revocable 30-day refresh token. Tokens live in `chrome.storage.session`; the plaintext password is never stored.
- Backend sender authorization independent of authentication.
- Rewrite and analytics context fields for sender, recipient, and conversation.
- Human/sender analytics grouping and portal display.

The extension never sends email and contains no OpenAI API key or permanent backend secret.

## Branch

`main`

## Important commits

- `406c5a6` — Initial management portal and extension foundation.
- `d6748a2` — Approve production dependency builds.
- `da95707` — Replace Google OAuth with native AMM Voice authentication and database permissions.

## Files added or materially changed

- `extension/manifest.json`, service worker, options UI, content script, and styles.
- `server/src/services/nativeAuth.ts`, `server/src/services/portalAuth.ts`, `server/src/services/auth.ts`.
- `server/prisma/schema.prisma` and `server/prisma/migrations/20260917020000_native_auth/migration.sql`.
- `server/src/app.ts`, configuration/startup, auth tests, extension/portal setup docs.

## Interfaces provided

### Authentication

`AuthPrincipal` contains stable database user ID, human email, optional name, and role. `NativeAuthService.authenticate` validates an opaque EXTENSION access token against its hashed, non-revoked PostgreSQL session record. Production composition excludes the local development-token adapter.

### Rewrite context

`POST /api/rewrite` accepts optional `senderAddress`, `recipientAddress`, and `conversationId`. It rejects client-supplied `authenticatedUser` because the schema is strict and identity comes from authentication.

### Extension configuration

`GET /api/extension/config` returns the authenticated human separately from their authorized sender addresses. For Cylina it should return her login identity plus both `cylina@authentic-moments.com` and `hello@authentic-moments.com`.

### Token lifecycle

- `POST /auth/extension/login`: email/password exchange for access + refresh tokens.
- `POST /auth/extension/refresh`: consumes the current refresh token and rotates both tokens.
- `POST /auth/extension/logout`: revokes the session identified by the bearer token.

The service worker retries one 401 after a successful refresh, then clears session tokens if refresh fails.

## Database requirements

- PostgreSQL and Prisma.
- Apply all committed migrations in order using `prisma migrate deploy`.
- `UserSenderPermission` is authoritative in production. `USER_SENDER_PERMISSIONS_JSON` is development fallback only.
- `hello@authentic-moments.com` is only a sender permission and must never be inserted as a login user.

## Authentication requirements

- Every employee signs in with an individual AMM Voice email/password account.
- Canonical ADMIN: `admin@authentic-moments.com`.
- Canonical TEAM user: `cylina@authentic-moments.com`.
- Google Cloud is not used for authentication.
- Sender use is denied unless stored for the authenticated user in PostgreSQL.
- Changing Gmail’s From address cannot change the access-token principal.

## Analytics requirements

- Preserve human and sender as independent dimensions.
- Do not log or persist full draft/thread bodies or credentials.
- Retain the opaque conversation reference only when available.
- Reports may aggregate by human, sender, or human+sender.

## Environment variables

- `PUBLIC_BASE_URL`, `DATABASE_URL`, `ALLOWED_ORIGINS`.
- `BOOTSTRAP_ADMIN_PASSWORD` and `BOOTSTRAP_TEAM_PASSWORD` only during one-time account creation.
- `DEV_AUTH_TOKEN` and `USER_SENDER_PERMISSIONS_JSON` only for local development behavior.
- Google client secrets, OAuth callbacks, `SESSION_SECRET`, email allowlists, and `EXTENSION_IDS` are obsolete and removed.

## UI integration requirements

- Load `extension/` as an unpacked extension for MVP testing.
- Configure its exact `chrome-extension://...` origin in `ALLOWED_ORIGINS`.
- The compose button must remain preview/replace only; never invoke Gmail Send.
- Gmail DOM selectors are best effort. If From detection fails, the UI requests a choice from backend-authorized sender addresses.
- Changing Gmail From selection must trigger fresh context detection and must not trigger reauthentication.

## Known limitations

- Gmail DOM selectors are undocumented and may need maintenance.
- Current preview and mode/sender selection use native confirm/prompt dialogs; a production panel should replace them.
- Only one recipient address is recorded even when Gmail contains multiple recipients.
- TOTP is deferred to the next authentication-hardening step.

## Tests

- Server typecheck, build, and 14-test Vitest suite pass.
- Portal production build passes.
- Extension JavaScript syntax checks pass.
- Manifest V3 no longer requests Chrome’s `identity` permission.

## Potential merge conflicts

- Shared auth/config/startup files, Prisma schema/migration ordering, `portal/src/main.tsx`, package lockfile, and Railway setup docs.
- Meeting Coach intentionally avoided these files; integration must use its ports and the canonical database user ID.

## Remaining work

1. Push/redeploy and apply the native-auth migration.
2. Bootstrap the two canonical users once, then remove bootstrap variables.
3. Configure the installed extension origin in `ALLOWED_ORIGINS`.
4. Perform a real Gmail end-to-end test with Cylina using both permitted From addresses, refresh rotation, and logout/revocation.
5. Replace native dialogs with the approved extension UI.
6. Add acceptance/regeneration telemetry after UX is finalized.
7. Reconcile shared systems with Meeting Coach during final integration.
