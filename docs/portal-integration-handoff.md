# Management portal and native-auth integration handoff

## What was built

- React/Vite management portal hosted by the existing Fastify/Railway service.
- Native AMM Voice email/password authentication with no Google Cloud authentication dependency.
- Argon2id password hashing, login throttling/temporary account lockout, normalized unique emails, and opaque hashed session tokens.
- Revocable portal sessions in HttpOnly, Secure-in-production, SameSite=Strict cookies with production Origin checks.
- Chrome-extension login with 15-minute access tokens and rotating 30-day refresh tokens stored in `chrome.storage.session`.
- ADMIN-only user creation and TEAM-password reset UI/API; user password change, current logout, and all-session logout.
- PostgreSQL user, sender-permission, and auth-session models. Sender identity remains separate from the authenticated human.
- Privacy-minimized analytics repository and the portal overview/management shell.

Google OAuth, Google Cloud, Firebase Authentication, and Google Identity Platform are not used for authentication. The prior OAuth implementation was removed rather than maintained as a competing system.

## Branch

`main`

## Important commits

- `406c5a6` — Initial management portal and extension foundation.
- `2a1b2ca` — Generate Prisma client inside the final deployed runtime image.
- `da95707` — Replace Google OAuth with native AMM Voice authentication.

## Files added

- `server/src/services/nativeAuth.ts`
- `server/prisma/migrations/20260917020000_native_auth/migration.sql`
- Portal application and design-system files previously recorded in `406c5a6`.

## Shared files modified

- `server/prisma/schema.prisma`
- `server/src/app.ts`, `server/src/config.ts`, `server/src/index.ts`
- `server/src/services/auth.ts`, `server/src/services/portalAuth.ts`
- `portal/src/main.tsx`, `portal/src/styles.css`
- `extension/manifest.json`, options UI, and service worker
- Root/server package manifests, lockfile, `.env.example`, README, and setup/security docs

## Interfaces provided

- `AuthPrincipal`: `{ id, email, name?, role? }`.
- `NativeAuthService`: portal/extension login, authentication, refresh rotation, revocation, password changes, user creation/listing, TEAM reset, bootstrap, and sender-permission lookup.
- Portal session user: `{ id, email, name, role: "ADMIN" | "TEAM" }`; `passwordHash` is never returned.
- `requirePortalUser(auth)` and `requireAdmin(auth)` Fastify pre-handlers.
- `GET /api/extension/config` returns human identity and server-authorized sender addresses.
- `AnalyticsRepository.record`, `overview`, and `audit` remain the analytics integration surface.

## Database requirements

Railway PostgreSQL with all committed Prisma migrations applied in order. Migration `20260917020000_native_auth` adds `User`, `UserSenderPermission`, and `AuthSession` plus `AuthSessionType`.

Canonical users and permissions:

- `admin@authentic-moments.com` → `ADMIN`; personal sender permission.
- `cylina@authentic-moments.com` → `TEAM`; `cylina@authentic-moments.com` and `hello@authentic-moments.com` sender permissions.
- `hello@authentic-moments.com` is not a `User` and cannot log in.

## Authentication requirements

- Canonical authentication: native AMM Voice email/password authentication.
- Google Cloud: not used for authentication.
- Passwords: Argon2id hashes only; source, APIs, and logs contain no plaintext or hashes.
- Production authorization: database user role and active state are checked server-side.
- The development bearer token adapter is present only outside production.
- Five failed password attempts produce a 15-minute lockout.
- Portal default/remembered sessions expire after 8 hours/30 days. Extension access/refresh tokens expire after 15 minutes/30 days.
- State-changing portal requests require the configured production Origin in addition to SameSite cookies.
- TOTP is intentionally deferred as the next hardening step so enrollment, recovery codes, and recovery policy can be implemented together without destabilizing MVP auth.

## Initial-user bootstrap

1. Choose separate strong temporary passwords of 12–256 characters.
2. Temporarily set `BOOTSTRAP_ADMIN_PASSWORD` and `BOOTSTRAP_TEAM_PASSWORD` on the Railway application service.
3. Deploy once. Startup creates only absent canonical accounts and sender permissions.
4. Verify login, remove both variables, and redeploy.
5. Users change temporary passwords from Settings; this revokes all existing sessions.

The bootstrap never overwrites an existing user. No plaintext password is hardcoded or documented.

## Analytics requirements

Live measured events remain separate from `HISTORICAL_CORPUS`. Full email bodies and thread text are not persisted. Human and sender are independent dimensions. Login, logout, password, user-creation, and admin reset actions are audit events without password material.

## Environment variables

- Required/current: `DATABASE_URL`, `PUBLIC_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `ALLOWED_ORIGINS` as appropriate.
- One-time only: `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_TEAM_PASSWORD`; remove after successful creation.
- Development only: `DEV_AUTH_TOKEN`, `USER_SENDER_PERMISSIONS_JSON`.
- Removed/obsolete: `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`, `TEAM_EMAILS`, `EXTENSION_IDS`, and all Google OAuth callback configuration.

## Routes

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `POST /auth/change-password`
- `POST /auth/extension/login`
- `POST /auth/extension/refresh`
- `POST /auth/extension/logout`
- `GET /api/admin/users` — ADMIN only
- `POST /api/admin/users` — ADMIN only
- `POST /api/admin/users/:id/reset-password` — ADMIN resetting TEAM only
- Existing authenticated portal/extension routes remain unchanged.

There are no public registration, sign-up, account-creation, Google login, or OAuth callback routes.

## UI integration requirements

The current shell uses a section-state switch rather than a full router. New features such as Meeting Coach should add navigation/pages through final integration rather than replacing the shell. Keep accessible empty/loading/error states and evidence labels. The Settings page is the canonical native-auth account-management UI.

## Known limitations

- TOTP is not implemented yet; it is the next authentication-hardening step.
- Password-reset email is intentionally absent. ADMIN-driven TEAM resets are the MVP recovery path.
- Most non-overview portal sections remain placeholders.
- User/sender analytics filters are available at the API but do not yet have portal filter controls.
- Expired/revoked session cleanup is not yet scheduled; validity checks still reject them.

## Assumptions

- Portal and API share one Railway service and exact HTTPS origin.
- Railway PostgreSQL is available whenever the production server starts.
- New users receive temporary passwords through a separate secure channel and change them after first login.

## Tests

Validated after the native-auth refactor:

- Server TypeScript typecheck passes.
- Server production build passes.
- Portal TypeScript/Vite production build passes.
- Server Vitest suite passes: 14 tests, including Argon2id verification, canonical bootstrap mapping, strict identity context, sender enforcement, secure cookie attributes, production Origin rejection, and TEAM rejection from ADMIN routes.
- Prisma schema validation passes.
- Extension service-worker/options JavaScript syntax checks pass.

Production verification on 2026-09-16:

- Railway deployment `bf0faa25-ce43-4324-bce1-da3897245174` is Active and reported “Deployment successful” for `1e9ce2e`.
- `PUBLIC_BASE_URL=https://ammserver-production.up.railway.app` is configured on the application service.
- `https://ammserver-production.up.railway.app/health` returned `{"status":"ok"}`.
- The public root rendered the native AMM Voice Email / Password / Remember me / Sign In form.
- A deliberately nonexistent user received the generic “Invalid email or password” response.
- Railway PostgreSQL lists `AuthSession`, `User`, and `UserSenderPermission`, confirming the native-auth migration was applied.
- No bootstrap passwords were supplied, so the canonical login rows were intentionally not created during this deployment.

## Potential merge conflicts

`portal/src/main.tsx`, portal styles/navigation, `server/src/app.ts`, auth/analytics services, Prisma schema/migrations, Docker/build scripts, package lockfile, and Railway setup documentation. Meeting Coach must adapt its `CurrentUserProvider` to the persisted `User.id`/`AuthPrincipal` rather than introduce a second user system.

## Remaining work

- Run the one-time canonical-user bootstrap after Zac supplies the two temporary passwords; then remove both bootstrap variables.
- Perform real portal and Gmail-extension login/revocation tests for both canonical users and both of Cylina’s sender addresses.
- Add TOTP enrollment, verification, recovery codes, and admin recovery policy as the next auth-hardening feature.
- Add portal analytics filter controls and replace remaining placeholder pages.
- Integrate Meeting Coach through its published ports during shared-system reconciliation.
