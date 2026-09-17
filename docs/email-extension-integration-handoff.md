# Email extension and identity-context handoff

## Extension experience continuation — `feature/extension-experience`

Implementation commits: `657c95f` (domain adapters, tests, and fixtures), `6eb8e9e` (accessible multi-compose UI, settings, and harness), `2ebc687` (extension-side adapter for canonical native auth `da95707`), `afc8f45` (meaningful-only Zac Review filtering), `1b75312` (merge canonical native auth, harden beta behavior, package/install preparation), `34bb946` (v0.1.1 receiver-safe service-worker fetch hotfix), `5132cb1` (v0.1.2 Gmail compose-control lifecycle recovery), and `2d16e1b` (new-outbound-email coaching capture boundary). Initial handoff: `ae97860`.

### Email Communication Coaching — extension capture boundary

#### What was built

- Passive, capture-phase observation of a trusted human click on Gmail's actual Send control. The handler reads the final compose state synchronously before Gmail can remove the compose, does not await network work, and never cancels, delays, triggers, or alters Gmail Send.
- Current-state capture for New Compose, Reply, Reply All, and Forward metadata: actual detected authorized From address, all currently represented To/Cc/Bcc addresses, current subject, current authored body, bounded thread context, conversation/compose references, and observation timestamp.
- Independent per-compose assistance lineage: whether AMM Style or Zac's Edit was requested, whether a suggestion was accepted, whether the accepted text was edited afterward, displayed warning codes, and whether a question-coverage warning was displayed. Original drafts and suggestions remain only in compose-scoped memory and are not included in the outbound payload.
- Backend-controlled `emailCoachingEnabled` configuration. Missing or non-boolean configuration defaults off. The settings page discloses the feature, its backend-controlled status, its new-email-only scope, and that AMM Voice never sends mail.
- `ExtensionApiClient.submitOutboundEmailForCoaching(payload)` centralizes the future endpoint. Its path is constructor-injected and intentionally absent until Core Platform supplies the canonical route; the current production composition therefore cannot upload coaching messages.
- Conceptual telemetry events use the existing privacy-minimized interface: `email_sent_observed`, `email_coaching_submission_started`, `email_coaching_submission_succeeded`, and `email_coaching_submission_failed`. No email content or addresses enter extension telemetry.

#### Send-safety guarantees

- The extension never clicks, dispatches, or simulates Gmail Send and never calls `preventDefault` or `stopPropagation` in the Send observer.
- Capture and submission failures are swallowed from Gmail's event path. No modal or compose error is shown after Send.
- Capture reads the final values at the trusted click, not stale values from the rewrite request.
- The observer never changes recipients, From, subject, body, signature, quoted history, or Gmail UI state.
- A strict sender check drops capture when the From address is missing, ambiguous, unauthorized, or outside the backend-provided sender list.

#### Privacy, history, deduplication, and retry

- There is no historical Sent-mail access, Sent-folder crawl, Gmail API, Google OAuth, Google Cloud, or background import. Coaching begins only for new outbound business messages after the backend enables it.
- `finalBody` is the authored outgoing body with common signature and quoted-history nodes excluded. Recent thread context is separate and remains bounded to six messages / 20,000 characters.
- Complete originals and suggestions are never persisted to Chrome storage. The final payload exists only in memory/runtime messaging for the immediate submission attempt.
- Each observed event gets a random `eventId`; the client sends it as `x-idempotency-key`. A compose-local content fingerprint suppresses the same snapshot for 15 seconds, covering duplicate DOM/event delivery while allowing a corrected second Send attempt when recipients or content change.
- Network/server failures receive zero background retries and no persistent raw-body queue. The event is dropped after the immediate attempt. The existing API client may perform its single access-token refresh retry after HTTP 401; no other retry occurs.

#### Required Core Platform contract — not yet implemented

`GET /api/extension/config` must return an explicit boolean `emailCoachingEnabled` alongside the authenticated human and authorized sender addresses. Missing/false disables capture.

Core Platform must select and inject one authenticated POST route into `ExtensionApiClient.outboundCoachingPath`. Expected request body:

```ts
{
  eventId: string;
  observedAt: string;
  composeId: string;
  composeMode: "new_compose" | "reply" | "reply_all" | "forward" | "unknown";
  senderAddress: string;
  recipientAddresses: string[];
  subject: string;
  finalBody: string;          // authored body; signature/quote excluded
  conversationRef?: string;
  threadContext?: string;     // bounded
  assistance: {
    ammStyleUsed: boolean;
    zacsEditUsed: boolean;
    rewriteAccepted: boolean;
    rewriteModifiedAfterward: boolean;
    warningsDisplayed: string[];
    questionCoverageWarningDisplayed: boolean;
  };
}
```

The access token, not the request body, identifies `authenticatedUser`. The backend must recheck the enablement policy and sender permission, deduplicate by `eventId`/`x-idempotency-key`, validate size/schema, apply retention/privacy policy, and return `{ accepted: true }` for a successful handoff.

#### Verification and limitations

- `node --test extension/tests/*.test.cjs`: 39/39 passed.
- All extension JavaScript passed `node --check`; manifest and rewrite fixtures parse successfully.
- Tests cover New Compose, Reply, Reply All, Forward, both authorized senders, unauthorized sender rejection, post-AMM-Style and post-Zac's-Edit manual edits, two compose windows, toolbar/larger-subtree state recovery, capture/backend failure safety, deduplication, no Send trigger, credential/payload privacy, policy-disabled capture, disclosure, and absence of historical/Gmail API access.
- Canonical backend config/route, persistence, analysis, permissions, retention, analytics storage, and portal reporting are not implemented here. No end-to-end production coaching claim is made.
- Gmail selectors remain undocumented. Real installed-Chrome testing must verify recipients and From detection in all modes, toolbar/subtree rebuilds immediately before Send, multiple windows, aliases, Bcc-only mail, and attachment-only mail.
- The MVP observes trusted Send-button clicks. Keyboard-only send shortcuts are not captured until Gmail's confirmed-send lifecycle can be observed without recording canceled confirmation prompts.

### Beta validation continuation

#### v0.1.2 Gmail compose-control lifecycle fix

- Root cause: Gmail can replace the toolbar subtree without replacing the compose dialog. The prior `WeakMap` treated a known compose as proof that its AMM controls were still attached, so a removed shell was never recreated.
- Lifecycle fix: compose state and control attachment are now separate. A small registry retains per-compose state, checks whether the expected shell is still the sole AMM shell in that compose, and moves the same shell into Gmail's replacement toolbar when necessary.
- Mutation handling: relevant element changes inside compose chrome and added/removed compose roots are microtask-coalesced. Draft-body mutations are ignored, there is no polling, and the full Gmail DOM is scanned only once at startup.
- Duplicate protection: reattachment verifies exactly one expected `.amm-voice-shell`; stale duplicates are removed before the retained shell is mounted.
- State safety: moving the existing shell preserves selected sender, open review, suggestion, loading state, and Undo snapshot. Draft, signature, quoted history, subject, and recipients are not mutated. Stable compose identity is used to rebind state when Gmail safely replaces a larger compose subtree; closed compose state is cleaned up.
- Coverage: automated tests cover initial attachment, toolbar removal/replacement, no duplicate injection, draft/signature/quote preservation, sender/review/Undo preservation, two-compose isolation, close cleanup, safe larger-subtree recovery, and New Compose/Reply/Reply All/Forward identities.
- Verification: all extension JavaScript passed syntax checks and `node --test extension/tests/*.test.cjs` passed 28/28 tests.
- Extension version advanced to `0.1.2`; prior beta releases remain immutable.
- GitHub prerelease: `https://github.com/conzious5/AMM-Chromeapp/releases/tag/v0.1.2-beta`; direct asset: `https://github.com/conzious5/AMM-Chromeapp/releases/download/v0.1.2-beta/AMM-Voice-Beta-v0.1.2.zip`.
- Published asset SHA-256: `42dc01c49f73b8fef5c017c9f5dbe751421afc7a32a9db74fef63574bce70d95`; the downloaded GitHub asset matched the validated local ZIP byte-for-byte.
- Manual installed-Chrome testing remains required across New Compose, Reply, Reply All, Forward, sender changes, deliberate compose-toolbar changes, and two simultaneous compose windows.

#### v0.1.1 service-worker fetch hotfix

- Root cause: both `NativeExtensionAuthProvider` and `ExtensionApiClient` stored a native `fetch` reference and later invoked it as an object method. Chrome's service-worker implementation requires a valid `WorkerGlobalScope` receiver, so installed v0.1.0 could throw `Failed to execute 'fetch' on 'WorkerGlobalScope': Illegal invocation`.
- Exact fix: the service worker now supplies `(...args) => globalThis.fetch(...args)`, while both reusable wrappers normalize default and injected fetch implementations through a receiver-safe wrapper.
- Authentication correction: refresh-token 401/403 responses still clear the session and produce `AUTHENTICATION_EXPIRED`; network/runtime exceptions during refresh now propagate as network failures without clearing tokens or signing the user out.
- User-facing runtime/network message: `AMM Voice couldn't connect. Your draft is safe. Please try again.`
- Regression coverage reproduces a receiver-sensitive WorkerGlobalScope fetch, verifies both native-auth and protected API requests, exactly one refresh attempt, rejected-refresh expiration, generic exception preservation, and failure-only draft safety.
- Production transport smoke tests reached `/api/rewrite` for both `amm_style` and `zacs_edit` and received the expected HTTP 401 for an intentionally invalid bearer token. Authenticated production rewriting remains a manual installed-beta retest.
- Extension version advanced to `0.1.1`; v0.1.0-beta remains immutable.
- GitHub prerelease: `https://github.com/conzious5/AMM-Chromeapp/releases/tag/v0.1.1-beta`; direct asset: `https://github.com/conzious5/AMM-Chromeapp/releases/download/v0.1.1-beta/AMM-Voice-Beta-v0.1.1.zip`.
- Published asset SHA-256: `7049e2e9898619bd2972ad47c829030c2fa113a6ae8ee6b48b32b5a2158b83a1`; downloaded GitHub asset matched the validated local ZIP byte-for-byte.

- Merged canonical `main` through production-auth deployment documentation `e06498d`; shared server, Prisma, Railway, portal, and analytics implementations were accepted unchanged.
- Production health returned HTTP 200 and the native login UI rendered at `https://ammserver-production.up.railway.app`.
- A production extension-login request using an intentionally invalid password returned HTTP 401 with the safe generic error `Invalid email or password.`
- Extension auth/API tests now cover session-only token storage, no password persistence, exactly one refresh retry, refresh-token revocation, offline logout cleanup, malformed responses, and expired authentication.
- Beta runtime files are staged under `dist/amm-voice-extension/` and zipped as `dist/AMM-Voice-Beta-v0.1.1.zip`; generated artifacts are ignored by Git.
- Installation guide: `docs/CYLINA_EXTENSION_INSTALL.md`.
- **BETA BLOCKED:** Valid Cylina credentials were not available to this agent, and Chrome's protected extension-management page cannot be automated. A human must load the unpacked package, sign in privately, and leave the live Gmail test session ready before the new-compose/reply/reply-all/forward, both-sender, replace/undo, and failure matrix can be certified.

### What works on the feature branch

- Two distinct compose actions: AMM Style and Zac's Edit.
- Compact inline compose panel with Suggested response, Replace Draft, Try Again, Undo, and Cancel.
- Meaningful Zac Review notes, calm backend warning display, and conditional client-question coverage.
- Independent `WeakMap`-backed state per Gmail compose window.
- From-address detection with fail-closed authorized sender selection.
- Six-message / 20,000-character thread context limits.
- Replacement limited to draft content before Gmail signature/quote nodes; exact immediate HTML snapshot for Undo.
- Explicit loading and recovery messages for auth, sender, draft, network, timeout, rate-limit, model, and API failures.
- Keyboard focus styles, ARIA labels/live regions, Escape dismissal, readable contrast, reduced-motion support, and responsive sizing.
- Settings for default action, Zac Review visibility, automatic sender detection, backend environment, and localhost-only mock authentication.
- `ExtensionAuthProvider`, `NativeExtensionAuthProvider`, `ExtensionApiClient`, and extension telemetry interfaces.
- Nineteen rewrite fixtures covering nine AMM Style and ten Zac's Edit scenarios.
- Dependency-free automated tests and a backend-free two-compose interaction harness.

### What is mocked or deferred

- `DevelopmentAuthProvider` and authorized senders are enabled only for localhost.
- `dev-harness.html` provides mock results, review notes, warnings, and configuration.
- Telemetry is a no-op; no competing analytics database or endpoint was added.
- `submitFeedback` exists at the API boundary but canonical feedback wiring is unavailable.
- Outbound coaching capture is off unless the backend explicitly returns `emailCoachingEnabled: true`; the canonical submission route is not yet supplied or wired.
- Live Gmail new-compose inspection verified the `g_editable="true"` draft body, a visible `.aDh` panel mount, the subject field, and fail-closed From detection. Reply, reply-all, forward, changed From, and installed-extension behavior remain.

### Canonical native-auth compatibility

The extension provider targets `da95707`: email/password login, `chrome.storage.session` tokens, rotating refresh, logout, and current configuration. Passwords are passed only to the login request, cleared from the form before awaiting the server, and never stored. The manifest does not request Chrome identity. Valid-user deployment verification must still exercise login, refresh, revocation, and allowed-sender flow.

### Verification

- `node --test extension/tests/*.test.cjs`: 39 tests passed.
- All extension JavaScript passed `node --check`.
- Manifest and the 19-scenario fixture corpus parse as JSON.
- Static tests guard multiple-compose isolation, sender fallback, thread limits, question display, session-only auth behavior, draft extraction, privacy-safe telemetry, and absence of Gmail Send interaction.
- Chrome exercised `extension/dev-harness.html` through a localhost-only server: both compose windows retained independent AMM Style/Zac's Edit panels, sender fallback exposed only the two authorized fixture identities, replacement preserved the signature, and Undo restored the exact prior HTML.

### Known Gmail limitations

- Gmail selectors are undocumented. Live new-compose inspection on September 16, 2026 found an additional Gmail AI prompt textbox and hidden toolbar; body selection now prefers `g_editable="true"`, and panel mounting now uses the visible Send-row container without interacting with Send.
- From detection intentionally falls back when Gmail hides or changes sender markup.
- Recent visible message extraction may need refinement for clipped messages, pop-out compose, unusual layouts, or multiple open threads.
- Signature/quote preservation covers common `.gmail_signature`, `.gmail_quote`, and smart-signature nodes; real Gmail fixtures are still required.
- Question coverage is a lightweight local review signal, not a guarantee that a reply fully answers a question.
- Trusted Send-button observation needs installed-Gmail verification; keyboard-only Send is intentionally deferred.

### Remaining integration dependencies

- Canonical native auth is merged through `e06498d`; resolved extension UI files preserve feature intent while server/auth/Prisma behavior remains canonical.
- Verify login, refresh rotation, logout/revocation, config, and sender authorization against the deployed backend.
- Run the real Gmail matrix: new compose, reply, reply all, forward, changed/collapsed From, shared sender, and multiple windows.
- Approve and connect canonical feedback/telemetry semantics.
- Core Platform must add the explicit coaching enablement field, canonical authenticated/idempotent submission route, server-side sender-policy recheck, persistence/retention rules, analysis workflow, and response contract described above.
- Prepare stable extension ID, CORS origin, store artwork/listing, permission/privacy disclosure, signing, and release QA.

## What was built

- Chrome Manifest V3 Gmail extension for developer/unpacked installation.
- Compose-window AMM Voice action, draft/thread collection, best-effort From/recipient/conversation detection, mode selection, preview, and explicit draft replacement.
- Native AMM Voice email/password login against the existing Railway backend; no Google OAuth or `identity` permission.
- A 15-minute opaque access token plus rotating, revocable 30-day refresh token. Tokens live in `chrome.storage.session`; the plaintext password is never stored.
- Backend sender authorization independent of authentication.
- Rewrite and analytics context fields for sender, recipient, and conversation.
- Human/sender analytics grouping and portal display.

The extension never sends email and contains no OpenAI API key or permanent backend secret.

## Branch

`main`

## Important commits

- `406c5a6` — Initial management portal and extension foundation.
- `d6748a2` — Approve production dependency builds.
- `da95707` — Replace Google OAuth with native AMM Voice authentication and database permissions.

## Files added or materially changed

- `extension/manifest.json`, service worker, options UI, content script, and styles.
- `server/src/services/nativeAuth.ts`, `server/src/services/portalAuth.ts`, `server/src/services/auth.ts`.
- `server/prisma/schema.prisma` and `server/prisma/migrations/20260917020000_native_auth/migration.sql`.
- `server/src/app.ts`, configuration/startup, auth tests, extension/portal setup docs.

## Interfaces provided

### Authentication

`AuthPrincipal` contains stable database user ID, human email, optional name, and role. `NativeAuthService.authenticate` validates an opaque EXTENSION access token against its hashed, non-revoked PostgreSQL session record. Production composition excludes the local development-token adapter.

### Rewrite context

`POST /api/rewrite` accepts optional `senderAddress`, `recipientAddress`, and `conversationId`. It rejects client-supplied `authenticatedUser` because the schema is strict and identity comes from authentication.

### Extension configuration

`GET /api/extension/config` returns the authenticated human separately from their authorized sender addresses. For Cylina it should return her login identity plus both `cylina@authentic-moments.com` and `hello@authentic-moments.com`.

### Token lifecycle

- `POST /auth/extension/login`: email/password exchange for access + refresh tokens.
- `POST /auth/extension/refresh`: consumes the current refresh token and rotates both tokens.
- `POST /auth/extension/logout`: revokes the session identified by the bearer token.

The service worker retries one 401 after a successful refresh, then clears session tokens if refresh fails.

## Database requirements

- PostgreSQL and Prisma.
- Apply all committed migrations in order using `prisma migrate deploy`.
- `UserSenderPermission` is authoritative in production. `USER_SENDER_PERMISSIONS_JSON` is development fallback only.
- `hello@authentic-moments.com` is only a sender permission and must never be inserted as a login user.

## Authentication requirements

- Every employee signs in with an individual AMM Voice email/password account.
- Canonical ADMIN: `admin@authentic-moments.com`.
- Canonical TEAM user: `cylina@authentic-moments.com`.
- Google Cloud is not used for authentication.
- Sender use is denied unless stored for the authenticated user in PostgreSQL.
- Changing Gmail’s From address cannot change the access-token principal.

## Analytics requirements

- Preserve human and sender as independent dimensions.
- Do not log or persist full draft/thread bodies or credentials.
- Retain the opaque conversation reference only when available.
- Reports may aggregate by human, sender, or human+sender.

## Environment variables

- `PUBLIC_BASE_URL`, `DATABASE_URL`, `ALLOWED_ORIGINS`.
- `BOOTSTRAP_ADMIN_PASSWORD` and `BOOTSTRAP_TEAM_PASSWORD` only during one-time account creation.
- `DEV_AUTH_TOKEN` and `USER_SENDER_PERMISSIONS_JSON` only for local development behavior.
- Google client secrets, OAuth callbacks, `SESSION_SECRET`, email allowlists, and `EXTENSION_IDS` are obsolete and removed.

## UI integration requirements

- Load `extension/` as an unpacked extension for MVP testing.
- Configure its exact `chrome-extension://...` origin in `ALLOWED_ORIGINS`.
- The compose button must remain preview/replace only; never invoke Gmail Send.
- Gmail DOM selectors are best effort. If From detection fails, the UI requests a choice from backend-authorized sender addresses.
- Changing Gmail From selection must trigger fresh context detection and must not trigger reauthentication.

## Known limitations

- Gmail DOM selectors are undocumented and may need maintenance.
- Current preview and mode/sender selection use native confirm/prompt dialogs; a production panel should replace them.
- Only one recipient address is recorded even when Gmail contains multiple recipients.
- TOTP is deferred to the next authentication-hardening step.

## Tests

- Server typecheck, build, and 14-test Vitest suite pass.
- Portal production build passes.
- Extension JavaScript syntax checks pass.
- Manifest V3 no longer requests Chrome’s `identity` permission.

## Potential merge conflicts

- Shared auth/config/startup files, Prisma schema/migration ordering, `portal/src/main.tsx`, package lockfile, and Railway setup docs.
- Meeting Coach intentionally avoided these files; integration must use its ports and the canonical database user ID.

## Remaining work

1. Push/redeploy and apply the native-auth migration.
2. Bootstrap the two canonical users once, then remove bootstrap variables.
3. Configure the installed extension origin in `ALLOWED_ORIGINS`.
4. Perform a real Gmail end-to-end test with Cylina using both permitted From addresses, refresh rotation, and logout/revocation.
5. Replace native dialogs with the approved extension UI.
6. Add acceptance/regeneration telemetry after UX is finalized.
7. Reconcile shared systems with Meeting Coach during final integration.
