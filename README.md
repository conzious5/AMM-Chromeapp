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

Local API testing can use `Authorization: Bearer <DEV_AUTH_TOKEN>` on `POST /api/rewrite`. In production, the portal and Chrome extension use native AMM Voice email/password authentication backed by Railway PostgreSQL. The extension receives short-lived, revocable backend tokens and never stores the plaintext password. `GET /health` is public.

## Chrome extension MVP

The installable Manifest V3 extension lives in `extension/`. It keeps the authenticated employee separate from Gmail's selected From address, validates shared senders through backend permissions, and never sends mail automatically. See [docs/extension-setup.md](docs/extension-setup.md).

See [docs/architecture.md](docs/architecture.md), [docs/corpus-import.md](docs/corpus-import.md), and [docs/security-and-privacy.md](docs/security-and-privacy.md).

## Management portal

The same Railway service hosts the authenticated React portal and Fastify API. Passwords are hashed with Argon2id, sessions and role authorization are enforced by the backend, and analytics are stored as structured, privacy-minimized PostgreSQL records through Prisma. No Google Cloud service is used for authentication. See [docs/portal-setup.md](docs/portal-setup.md).
