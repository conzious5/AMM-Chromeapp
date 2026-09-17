# Management portal setup

## Railway

The portal and API share one service and public origin. Add a Railway PostgreSQL service and reference its connection variable as `DATABASE_URL`. Before deploying, run:

```bash
pnpm --filter @amm/server exec prisma migrate deploy
```

Required application variables:

- `DATABASE_URL`: Railway PostgreSQL connection URL.
- `PUBLIC_BASE_URL`: public origin, currently `https://ammserver-production.up.railway.app`.
- `SESSION_SECRET`: at least 32 random characters.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Google OAuth web client credentials.
- `ADMIN_EMAILS`: comma-separated administrator email allowlist.
- `TEAM_EMAILS`: optional comma-separated team allowlist.
- `EXTENSION_IDS`: comma-separated Chrome extension IDs allowed to complete OAuth in production.
- `USER_SENDER_PERMISSIONS_JSON`: JSON map from authenticated employee email to allowed Gmail From addresses. Example: `{"cylina@authentic-moments.com":["cylina@authentic-moments.com","hello@authentic-moments.com"]}`.

In Google Cloud Console, create an OAuth 2.0 Web application and set the authorized redirect URI to:

`https://ammserver-production.up.railway.app/auth/google/callback`

Also add the extension OAuth callback:

`https://ammserver-production.up.railway.app/auth/extension/callback`

## Custom domain

In Railway service settings, add `voice.authentic-moments.com` or `portal.authentic-moments.com` under Public Networking, then create the DNS record Railway provides. Update `PUBLIC_BASE_URL` and add the matching Google OAuth callback URI before switching traffic.

## Data labels

The portal distinguishes measured live events from historical corpus classifications. It never backfills historical AMM Style or Zac's Edit usage because those operations did not occur historically. Empty installations show “Not enough data yet” rather than fabricated zeroes or trends.
