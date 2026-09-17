# Security and privacy

- OpenAI credentials stay on the server.
- Model requests set `store: false`.
- Logs contain request metadata only: request ID, authenticated human user, sender address, mode, model, latency, usage, and success/failure.
- Full drafts and threads are neither logged nor persisted by default.
- Request sizes are capped and thread context is trimmed from the oldest end.
- Training output is written only to ignored local directories until a human explicitly approves an anonymized example.
- The development bearer token remains a local-only adapter and is excluded from production auth composition. Production users authenticate with native email/password credentials; Argon2id hashes and opaque session-token hashes are stored in PostgreSQL.
- Portal sessions use HttpOnly, Secure-in-production, SameSite=Strict cookies, expiration, revocation, rate limits, and production origin checks. Extension access tokens last 15 minutes and use rotating, revocable refresh tokens stored only in `chrome.storage.session`.
- The request body cannot assert or replace the authenticated human identity. Server-side role checks protect administrator routes.
- Sender addresses are checked against backend permissions for the authenticated employee. A shared sender such as `hello@authentic-moments.com` is never treated as a human login by default.
- Railway should be configured with TLS, secret environment variables, restricted project access, the exact `PUBLIC_BASE_URL`, and a production `ALLOWED_ORIGINS` value.
- Google OAuth, Firebase Authentication, Google Identity Platform, and Google Cloud credentials are not part of AMM Voice authentication.
