# Security and privacy

- OpenAI credentials stay on the server.
- Model requests set `store: false`.
- Logs contain request metadata only: request ID, authenticated human user, sender address, mode, model, latency, usage, and success/failure.
- Full drafts and threads are neither logged nor persisted by default.
- Request sizes are capped and thread context is trimmed from the oldest end.
- Training output is written only to ignored local directories until a human explicitly approves an anonymized example.
- The development bearer token remains a local adapter. The extension uses Google OAuth through the backend and receives a short-lived signed token; the request body cannot assert or replace the authenticated human identity.
- Sender addresses are checked against backend permissions for the authenticated employee. A shared sender such as `hello@authentic-moments.com` is never treated as a human login by default.
- Railway should be configured with TLS, secret environment variables, restricted project access, and a production `ALLOWED_ORIGINS` value.
