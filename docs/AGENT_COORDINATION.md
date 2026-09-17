# AMM Voice agent coordination

Shared repository communication channel. Agents must append or narrowly edit their owned feature section and truly shared facts. Do not erase another feature's notes. Committed code is authoritative when a summary differs.

## Current feature branches

| Branch | Feature | Ownership/status |
|---|---|---|
| `main` | Core rewrite service, management portal, Google/extension authentication, Manifest V3 Gmail extension, analytics foundation | Current committed integration baseline. Extension/auth/identity work is described below. |
| `feature/extension-experience` | Chrome extension UI, Gmail compose experience, local mocks/tests | Implemented through `afc8f45`, including native-auth adapter `2ebc687`; canonical server auth, Prisma, portal, analytics, Railway, and Meeting Coach are untouched. |
| `feature/meeting-coach` | Meeting Coach transcript analysis and coaching domain | Independently implemented through inbox-intake commit `7bb7d6b`; not integrated into shared auth, Prisma, routes, analytics, or portal. |

## Completed work

### Email extension, identity, and sender context — owner: main / commit `406c5a6`

- Manifest V3 Gmail extension with unpacked installation path.
- Google OAuth extension flow and short-lived signed backend token.
- Human authentication is independent from Gmail's selected From address.
- Rewrite requests support `senderAddress`, `recipientAddress`, and `conversationId`; `authenticatedUser` is derived from authentication and cannot be asserted in the request body.
- Per-user sender permissions are backend configuration.
- Analytics persist and group human user and sender address independently.
- Management portal shell and human+sender usage breakdown.
- Prisma analytics migration and Google/Railway setup documentation.

Handoff: `docs/email-extension-integration-handoff.md`.

### Extension experience — owner: `feature/extension-experience`

- Replaces native prompt/confirm/alert flow with two explicit compose actions and an accessible inline review panel.
- Adds independent per-compose state, fail-closed sender selection, limited thread extraction, safe replacement/Undo, warning and question-coverage UI, settings, local auth/API/telemetry boundaries, fixtures, tests, and a two-compose harness.
- Extension-side native auth provider targets canonical commit `da95707` without changing server authentication: email/password login, session-only access/refresh tokens, one refresh retry, and logout/revocation.
- Does not modify canonical authentication, User/Prisma schema, Railway, portal, analytics database, or Meeting Coach.

Authoritative handoff: `docs/email-extension-integration-handoff.md` on `feature/extension-experience`.

### Management portal deployment — owner: main / commits `406c5a6`, `2a1b2ca`, `5cf7526`

- Portal/API is deployed at `https://ammserver-production.up.railway.app` and the public health and HTML entry points are verified.
- Railway PostgreSQL is provisioned, referenced by the application as `DATABASE_URL`, and both committed Prisma migrations are applied. Verified tables: `_prisma_migrations`, `AnalyticsEvent`, `AuditEvent`, `ConversationSignal`, `ProfileVersion`, `Report`, and `TrainingCandidate`.
- Railway runs `prisma migrate deploy` as a pre-deploy command. The Docker runtime generation fix in `2a1b2ca` is required so the packaged Prisma client is initialized after workspace deployment.
- Google OAuth is intentionally still unavailable in production until Zac supplies/approves the OAuth web client and exact admin/team email allowlists. The login page reports this as an unconfigured state rather than bypassing authentication.

### Meeting Coach — owner: `feature/meeting-coach`

- Transcript parsing, speaker inference, question extraction, classification, evidence-grounded analysis, scoring, coaching reports, trends, goals, model adapter, repository/integration ports, tests, and evals.
- Tested email-intake boundary for notes delivered to `hello@authentic-moments.com` with subjects shaped like `Notes: “Final Consultation - Alexis Legg and Authentic Moments” Sep 16, 2026.`; preserves Gmail message ID and extracts meeting metadata plus body/text-attachment content.
- No shared auth, Prisma, route, analytics repository, portal shell, or Railway changes were made on the feature branch.

Authoritative handoff on branch: `docs/meeting-coach-handoff.md` through `7bb7d6b`. Detailed integration log: `docs/meeting-coach-integration.md`. Schema proposal: `docs/meeting-coach-schema-proposal.md`.

## Canonical architecture decisions

These are explicit product requirements rather than feature-agent preferences:

1. Authentication identifies the human employee.
2. Email context independently identifies the selected sender/From address.
3. Shared addresses such as `hello@authentic-moments.com` are not employee accounts unless explicitly configured later.
4. Every employee authenticates with an individual company Google account and receives permissions/configuration from the backend.
5. Analytics must support human user, sender address, and human+sender reporting.
6. The MVP client is a Chrome Manifest V3 extension with unpacked installation support and a future Web Store/managed Workspace distribution path.
7. The extension never sends email automatically.
8. Chrome/Gmail DOM logic remains separate from backend business logic so a future Gmail Workspace Add-on can reuse authentication policy, voice profiles, analytics, OpenAI services, and Zac's Edit.
9. The Workspace Add-on is not part of the MVP.
10. Current business facts remain separate from stable voice profiles.

## Proposed architecture decisions

### Meeting Coach proposals — not yet reconciled

- Adapt canonical auth into `CurrentUserProvider`.
- Implement Meeting Coach repositories against the final Prisma model after schema review.
- Register routes under `/api/meeting-coach/*` after canonical auth/error/rate-limit conventions are confirmed.
- Adapt Meeting Coach analytics events into the canonical analytics service without transcript text or evidence quotes.
- Add a Meeting Coach portal navigation group using the existing design system and `buildMeetingReportViewModel`.

See the branch handoff before accepting these proposals.

## Shared interfaces

### Rewrite request context

```ts
{
  mode: "amm_style" | "zacs_edit";
  draft: string;
  subject: string;
  thread: string;
  recipientName?: string;
  senderAddress?: string;
  recipientAddress?: string;
  conversationId?: string;
}
```

`authenticatedUser` is deliberately absent. It comes from `AuthPrincipal.email`.

### Authentication principal

```ts
interface AuthPrincipal {
  id: string;
  email: string;
  name?: string;
  role?: "ADMIN" | "TEAM" | "DEVELOPMENT";
}
```

### Meeting Coach integration surface

`feature/meeting-coach` exports its stable surface from `server/src/meeting-coach/index.ts`, including repository ports, `CurrentUserProvider`, `MeetingCoachAnalytics`, `NotificationService`, model adapter, analysis service, and report view model. Inspect the branch implementation before adapting it.

It also exports `TranscriptMailboxSource` and `emailToTranscriptCandidate`. The final Gmail client should implement this boundary rather than placing Gmail API logic inside the analysis service.

## Shared data models

### Current committed analytics identity fields

- `actorId`: stable principal ID retained for compatibility.
- `authenticatedUser`: human employee email.
- `senderAddress`: selected Gmail From address.
- `recipientAddress`: current recipient address when detected.
- `conversationRef`: persisted from request `conversationId`.

### Meeting Coach data

No canonical Prisma models have been accepted. The feature branch contains a relational proposal only.

## Authentication conventions

- Portal users authenticate through Google OAuth and an `ADMIN_EMAILS`/`TEAM_EMAILS` allowlist.
- Extension users authenticate through backend Google OAuth and receive an eight-hour signed bearer token.
- Extension redirect URIs are limited by `EXTENSION_IDS` in production.
- Sender authorization comes from `USER_SENDER_PERMISSIONS_JSON` and is enforced by the backend.
- Request bodies cannot set the authenticated human.
- A future canonical user table may replace environment allowlists; final reconciliation must preserve the human/sender separation.

## Analytics conventions

- Do not persist full email drafts or thread bodies in analytics.
- Record identity and context independently: human, sender, recipient, opaque conversation reference.
- Portal overview supports optional `authenticatedUser` and `senderAddress` filters and returns `identityBreakdown`.
- Meeting Coach events must not contain raw transcripts or direct evidence quotes.
- Historical corpus classifications remain distinct from measured live events.

## OpenAI service conventions

- Model calls occur only on the backend.
- OpenAI requests use `store: false`.
- Validate structured model output with Zod.
- Do not log email bodies, transcript text, or evidence quotes.
- Existing email rewriting uses the shared `LanguageModel` abstraction. Meeting Coach currently has a separate feature-local model adapter that follows the same Responses API conventions; consolidation is a final-integration decision.

## Database/schema decisions

- PostgreSQL via Prisma is the current committed portal/analytics datastore.
- Existing migrations must be preserved in order.
- `AnalyticsEvent` contains optional identity/sender fields to allow migration of pre-existing events; all new rewrite events populate `authenticatedUser`.
- Meeting Coach did not modify Prisma. Its proposed models must be reconciled rather than copied blindly.

## Routes

### Current committed routes

- `GET /health`
- `POST /api/rewrite`
- `GET /api/extension/config`
- `GET /api/portal/overview`
- `GET /api/portal/metric-definitions`
- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /auth/extension/start`
- `GET /auth/extension/callback`
- `GET /auth/me`
- `POST /auth/logout`

### Meeting Coach proposed routes

See `docs/meeting-coach-integration.md` on `feature/meeting-coach`. None are registered on `main`.

## Environment variables

- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `DEV_AUTH_TOKEN`
- `DATABASE_URL`
- `PUBLIC_BASE_URL`, `SESSION_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `ADMIN_EMAILS`, `TEAM_EMAILS`
- `EXTENSION_IDS`
- `USER_SENDER_PERMISSIONS_JSON`
- `ALLOWED_ORIGINS`
- Existing server size/rate-limit/host/port variables in `.env.example`

Meeting Coach currently introduces no required environment variable.

## Known conflicts

No direct implementation conflict is currently confirmed.

### Integration-risk areas

- Meeting Coach production persistence will modify `server/prisma/schema.prisma` and migration order, which are already used by portal analytics.
- Meeting Coach route registration will modify `server/src/app.ts`, which owns rewrite, portal, auth, and static routes.
- Meeting Coach analytics must adapt to `AnalyticsRepository` without forcing email-only fields onto meeting events.
- Meeting Coach portal pages will modify the current single-file portal shell and navigation.
- The Meeting Coach `CurrentUserProvider` must adapt to `AuthPrincipal`/portal session conventions without introducing a second user identity system.

Record a `CONFLICT` entry here if incompatible concrete implementations appear. Do not silently choose one.

## Integration dependencies

- Meeting Coach depends on final adapters for auth, persistence, analytics, routes, portal navigation, and optionally notifications/jobs.
- Meeting Coach transcript intake depends on read access to mail delivered to `hello@authentic-moments.com`, idempotent processing keyed by Gmail message ID, and confirmation of whether real transcript content is in the email body, a text attachment, or a link.
- Extension production sign-in depends on Google redirect registration, Railway environment configuration, and a stable Chrome extension ID.
- Analytics deployment depends on running Prisma migrations.

## Decisions requiring Zac

- Final admin visibility into individual Meeting Coach reports and whether raw transcript evidence is ever visible to management.
- Transcript retention/deletion policy.
- Whether sender permissions remain environment-managed for MVP or move immediately into database administration UI.
- Final production domain and managed-extension distribution timing.
- Exact `ADMIN_EMAILS` and `TEAM_EMAILS` allowlists for the live portal.
- Google OAuth web client credentials with the production portal and extension callbacks registered.
- A redacted example of the actual transcript-delivery email body/attachments so the Gmail extractor can be finalized without over-broad mailbox access.

## Final integration status

- Email extension/auth/identity/analytics foundation: committed on `main`; portal/API and PostgreSQL deployment are verified. Production Google OAuth, email allowlists, session secret, and extension-ID configuration remain.
- Meeting Coach: feature-complete on its branch at the domain/service level with shared-inbox intake boundary at `7bb7d6b`; live Gmail, shared-system integration, and transcript-content confirmation remain.
- Final reconciliation of auth, Prisma, analytics, routes, portal navigation, Railway, and Google integration has not been performed.
