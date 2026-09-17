# Security and privacy

- OpenAI credentials stay on the server.
- Model requests set `store: false`.
- Logs contain request metadata only: request ID, authenticated principal, mode, model, latency, usage, and success/failure.
- Full drafts and threads are neither logged nor persisted by default.
- Request sizes are capped and thread context is trimmed from the oldest end.
- Training output is written only to ignored local directories until a human explicitly approves an anonymized example.
- The development bearer token is an adapter, not the final identity system. Replace `AuthService` with Google identity plus an allowlist before broader use.
- Railway should be configured with TLS, secret environment variables, restricted project access, and a production `ALLOWED_ORIGINS` value.
