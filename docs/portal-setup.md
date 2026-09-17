# Management portal setup

## Canonical authentication

AMM Voice uses first-party email/password authentication hosted entirely by the existing Railway application and PostgreSQL database. Google Cloud, Google OAuth, Firebase Authentication, and Google Identity Platform are not used for authentication.

The canonical identities are:

- `admin@authentic-moments.com` — `ADMIN`
- `cylina@authentic-moments.com` — `TEAM`
- `hello@authentic-moments.com` — shared sender permission for Cylina, never a login account

Passwords are Argon2id hashes. Portal sessions are opaque, revocable PostgreSQL records carried in HttpOnly, Secure-in-production, SameSite=Strict cookies. State-changing portal requests also require the configured application origin in production.

## Railway

The portal and API share one service and public origin. Railway PostgreSQL is connected as `DATABASE_URL`. The pre-deploy command must continue to run:

```bash
node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
```

Required application variables:

- `DATABASE_URL`: Railway PostgreSQL connection URL.
- `PUBLIC_BASE_URL`: exact public origin, currently `https://ammserver-production.up.railway.app`.
- `OPENAI_API_KEY` and `OPENAI_MODEL`: existing rewrite service configuration.
- `ALLOWED_ORIGINS`: Chrome extension origins allowed to call the API. This is CORS configuration, not authentication.

`USER_SENDER_PERMISSIONS_JSON` is a local-development fallback only. Production user and sender permissions are stored in PostgreSQL.

## One-time initial-user bootstrap

No initial password is committed, logged, or stored in documentation.

1. Choose separate strong temporary passwords of 12–256 characters for the admin and Cylina.
2. Temporarily add `BOOTSTRAP_ADMIN_PASSWORD` and `BOOTSTRAP_TEAM_PASSWORD` to the Railway application service.
3. Deploy once. Startup creates only missing canonical accounts, stores Argon2id hashes, and assigns Cylina both her personal and shared sender addresses. Existing accounts are never overwritten.
4. Confirm each user can sign in.
5. Delete both bootstrap variables from Railway and redeploy.
6. Each user changes their temporary password in Portal → Settings. A password change revokes all existing sessions.

The bootstrap is idempotent by normalized unique email. Do not leave the bootstrap variables configured after initial creation.

## Account administration

There is no sign-up or public registration route. An authenticated `ADMIN` can create authorized users and reset a `TEAM` user’s password from Settings. Roles and permissions are checked by the backend. Users can change their password, log out the current session, or revoke all of their sessions.

Password reset by email is intentionally not included in the MVP because it would add an external delivery dependency.

## Two-factor authentication

TOTP is the next authentication-hardening step. The current database-backed user/session design can add encrypted TOTP enrollment state and recovery codes without an external or paid authentication provider, but TOTP is intentionally deferred until enrollment, recovery, and lockout flows can be implemented and tested together.

## Custom domain

In Railway service settings, add `voice.authentic-moments.com` or `portal.authentic-moments.com` under Public Networking, then create the DNS record Railway provides. Update `PUBLIC_BASE_URL` to the exact HTTPS origin before switching traffic.

## Data labels

The portal distinguishes measured live events from historical corpus classifications. It never backfills historical AMM Style or Zac's Edit usage because those operations did not occur historically. Empty installations show “Not enough data yet” rather than fabricated zeroes or trends.
