# AMM Voice

AMM Voice is an internal email-writing assistant for Authentic Moments Media. It separates stable communication style from changing business facts and exposes two review modes:

- **AMM Style**: a concise brand-voice rewrite.
- **Zac's Edit**: a deeper customer-service review with meaningful notes.

## Architecture

`Gmail extension -> authenticated Railway API -> rewrite service -> style repository + business rules -> OpenAI Responses API`

The server sends `store: false`, never logs email bodies, retrieves only a small set of approved examples, and keeps historical examples subordinate to current business rules and the current thread.

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm test
pnpm dev
```

The API requires `Authorization: Bearer <DEV_AUTH_TOKEN>` on `POST /api/rewrite`. `GET /health` is public.

See [docs/architecture.md](docs/architecture.md), [docs/corpus-import.md](docs/corpus-import.md), and [docs/security-and-privacy.md](docs/security-and-privacy.md).

## Management portal

The same Railway service hosts the authenticated React portal and Fastify API. Google OAuth is allowlisted with `ADMIN_EMAILS` and `TEAM_EMAILS`; analytics are stored as structured, privacy-minimized PostgreSQL records through Prisma. See [docs/portal-setup.md](docs/portal-setup.md).
