# AMM Style grounding handoff

## What was built

The canonical rewrite backend now treats AMM Style as draft-preserving polish. It structures the existing request into current draft, latest inbound, recent relevant thread, and older history; makes the current draft authoritative; distinguishes empty-draft reply generation; and separates this behavior from Zac's Edit omission analysis.

AMM Style output is checked for unsupported facts and topic drift. A failing candidate is regenerated once with constrained instructions. If the retry still drifts, a non-empty original draft is returned unchanged with: `This suggestion may have added information not present in your draft. Review carefully.` Empty-draft generation fails closed when both attempts are unsafe.

## Branch and important commits

- Canonical branch: `main`
- Canonical backend commit: `09834ec` (`Keep AMM Style grounded in the current draft`)
- Extension companion branch: `feature/extension-experience`
- Extension companion commit: `b88bce5` (`Refine extension rewrite context`)

## Files added

- `server/src/services/rewriteContext.ts`
- `server/src/services/topicDrift.ts`
- `docs/amm-style-grounding-handoff.md`

## Shared files modified

- Backend prompts, rewrite orchestration, safety checks, request schema, model result type, error classification, route logging, model tests, rewrite tests, and synthetic eval fixtures.
- `docs/AGENT_COORDINATION.md` and `docs/email-extension-integration-handoff.md` contain the shared integration notes.
- Agent 3 modified only extension-owned context extraction, warning mapping, tests, and extension handoff notes on `feature/extension-experience`.

## Interfaces provided

`POST /api/rewrite` retains its public request and response shape. Internally, the model receives labeled source sections and an explicit editing contract. Privacy-safe server logs may include regeneration/block state and category codes, but never draft/thread content.

Agent 3 retains `draft` as the current draft and sends a bounded, labeled `thread` containing `Latest inbound`, `Recent relevant thread`, and `Older history`. It maps `TOPIC_DRIFT`, `UNSUPPORTED_FACT`, and `UNRELATED_THREAD_CONTEXT` warnings to the user-facing caution without exposing token or email content.

## Database, authentication, analytics, and environment requirements

- Database: none.
- Authentication: unchanged; canonical native auth and sender authorization remain authoritative.
- Analytics: existing rewrite analytics remain unchanged. Guardrail state is operational logging, not a new persisted analytics model.
- Environment variables: none added. Existing `OPENAI_API_KEY` and `OPENAI_MODEL` remain server-only.

## Routes

- Existing `POST /api/rewrite` only. No route was added or changed.

## UI integration requirements

The extension companion must be merged/released separately. It reduces and labels thread context before sending it and displays the exact caution when backend guard categories indicate substantive drift. AMM Style remains rewrite-first; Zac's Edit may surface meaningful missed-context review notes.

## Known limitations and assumptions

- Gmail DOM extraction still requires real-Chrome validation across New Compose, Reply, Reply All, and Forward.
- Deterministic guards target high-risk facts and known substantive topic categories; the prompt contract and constrained regeneration remain additional layers.
- A successful Railway deployment and health check do not certify every live OpenAI output. Synthetic fixtures and mocked model regressions passed; authenticated production rewrite QA remains a manual/internal validation item because no credentials or production secrets are stored in this handoff.

## Tests

- Canonical production-lineage checkout: 27/27 server tests passed; TypeScript typecheck and build passed.
- Full local integration checkout including pending Email Communication work: 31/31 server tests passed; TypeScript typecheck and build passed.
- Regression coverage includes invoice/payment versus older apparel, pricing, shipping, and ordering history; one retry; safe fallback; labeled source segmentation; empty drafts; Zac's Edit separation; and privacy-safe error classification.
- Synthetic eval fixtures cover payment confirmation, delivery update, client excitement, multiple questions, unrelated history, old pricing, and changed/long-running topics.
- Agent 3 extension companion: 51/51 extension tests plus JavaScript syntax and Manifest V3 validation passed.

## Potential merge conflicts

- `server/src/app.ts`, rewrite prompts/services/types/tests, and `docs/AGENT_COORDINATION.md` are shared integration surfaces.
- The extension companion is intentionally not merged into `main` by this backend handoff. Preserve its commit when preparing the next extension beta.

## Production status

Railway reported deployment success for canonical commit `09834ec` on 2026-09-17, and `https://ammserver-production.up.railway.app/health` returned `{"status":"ok"}`.

## Remaining work

1. Run authenticated synthetic production rewrites for all eval scenarios without exposing credentials or production environment secrets.
2. Manually verify live Gmail context extraction and warning presentation after the Agent 3 companion is included in a later extension build.
3. Do not alter canonical auth, Prisma, Railway architecture, Portal Analytics, or Meeting Coach as part of this follow-up.
