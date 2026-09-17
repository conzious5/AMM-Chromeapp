# Architecture

## Phase 1: communication intelligence

The server owns all intelligence and sensitive processing:

1. Validate and minimize the request.
2. Retrieve current business rules and a few approved examples through `StyleRepository`.
3. Generate a structured rewrite through the OpenAI Responses API with storage disabled.
4. Run deterministic post-generation checks for invented high-risk facts, unsupported commitments, excessive apology, defensive/cold wording, missing next steps, and excessive length.
5. Return the rewrite, concise review notes, warnings, and an opaque request ID.

Corpus processing is intentionally separate. A Takeout MBOX file is parsed locally, sent messages are paired with the nearest prior external message in the same thread, obvious low-value messages are filtered, PII is anonymized, and useful pairs can be analyzed into structured JSON. Nothing enters the approved library automatically.

## Boundaries

- `StyleRepository` hides the storage/retrieval implementation. The MVP uses local files; vector search or PostgreSQL can replace it.
- `LanguageModel` hides OpenAI, which also makes the rewrite and evaluation logic testable without network calls.
- Style profiles never contain current prices, turnaround times, staffing, or policies.
- `current-business-rules.json` is the only approved mutable business-fact source in the MVP.
- The Manifest V3 extension only gathers minimal visible compose/thread context and presents a preview. It never sends mail automatically.
- Authentication identifies the human employee. The Gmail From address is separate request context and never selects or changes the authenticated user.
- Chrome-specific Gmail DOM extraction lives only in the extension. Authentication policy, sender permissions, prompts, analytics, voice profiles, and Zac's Edit remain backend-owned so a future Workspace Add-on can reuse them.

## Identity and email context

Every live rewrite can carry four independent dimensions:

- `authenticatedUser`: derived only from the verified Google login token;
- `senderAddress`: detected from the active Gmail compose From selector and validated against backend permissions;
- `recipientAddress`: detected from the active compose recipient;
- `conversationId`: an opaque Gmail/thread reference when available.

For Cylina, `authenticatedUser` remains `cylina@authentic-moments.com` whether Gmail sends from `cylina@authentic-moments.com` or `hello@authentic-moments.com`. Shared addresses are resources, not employee identities. Analytics may filter and group by human user, sender address, or the pair.

Employees install the same extension build. Google authentication and backend configuration determine their role and permitted sender addresses; no per-employee source edit is required.

## Prompt priority

1. Current email thread
2. Current approved business rules
3. Draft intent
4. AMM communication principles
5. Approved, anonymized examples
6. General model knowledge
