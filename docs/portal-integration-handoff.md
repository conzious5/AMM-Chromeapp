# Management portal integration handoff

## What was built

- React/Vite management portal hosted by the existing Fastify/Railway service.
- Google OAuth portal session with admin/team allowlists.
- Privacy-minimized analytics repository backed by Prisma/PostgreSQL.
- Overview KPIs, live trends, Zac's Edit interventions, attention queue, and human+sender usage table.
- Empty/unconfigured states that do not fabricate analytics.
- Design system reference under `design-system/amm-voice/MASTER.md`.

## Branch

`main`

## Important commits

- `406c5a6` — Add secure management portal and extension authentication.
- `d6748a2` — Approve production dependency builds.

## Files added

- `portal/`
- `design-system/amm-voice/MASTER.md`
- `server/src/services/portalAuth.ts`
- `server/src/services/analyticsRepository.ts`
- `server/prisma/`
- `docs/portal-setup.md`

## Shared files modified

- `server/src/app.ts`, `server/src/config.ts`, `server/src/index.ts`
- Root/server package manifests and lockfile
- `Dockerfile`, `.env.example`, `README.md`

## Interfaces provided

- Portal session user: `{ email, name, role: "ADMIN" | "TEAM" }`.
- `requirePortalUser` Fastify pre-handler.
- `AnalyticsRepository.record`, `overview`, and `audit`.
- Portal overview response includes measured KPIs, trends, interventions, contact reasons, attention queue, and `identityBreakdown`.

## Database requirements

Railway PostgreSQL with committed Prisma migrations applied in order.

## Authentication requirements

Google OAuth web client, backend callback registration, session secret, and email allowlists. Portal sessions and extension bearer tokens intentionally use different adapters while resolving to the same human-email convention.

## Analytics requirements

Live measured events remain separate from `HISTORICAL_CORPUS`. Email bodies and thread text are not persisted. Human and sender are independent dimensions.

## Environment variables

`DATABASE_URL`, `PUBLIC_BASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`, `TEAM_EMAILS`.

## Routes

- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /api/portal/overview`
- `GET /api/portal/metric-definitions`

## UI integration requirements

The current shell uses a section-state switch rather than a full router. New features such as Meeting Coach should add navigation/pages through final integration rather than replacing the shell. Use the established design system, accessible empty/loading/error states, and evidence labels.

## Known limitations

- Most non-overview portal sections are placeholders.
- User/sender filters are available at the API but do not yet have portal filter controls.
- Attention signals need a production ingestion/classification path.
- No canonical database user/permission administration UI exists.

## Assumptions

The portal and API share a Railway service and public origin. Management users are explicitly allowlisted.

## Tests

Portal TypeScript compilation and Vite production build pass. Server route/auth tests pass as part of the 10-test Vitest suite.

## Potential merge conflicts

`portal/src/main.tsx`, portal styles/navigation, `server/src/app.ts`, auth/analytics services, Prisma schema/migrations, Docker/build scripts, and lockfile.

## Remaining work

- Deploy/configure Google OAuth and PostgreSQL.
- Add portal filter controls for human user and sender address.
- Replace placeholder pages with production data views.
- Integrate Meeting Coach through its view-model and service ports after shared-system reconciliation.
- Add admin permission management if environment allowlists are replaced.
