# Email extension and identity-context handoff

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
