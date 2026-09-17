# Data governance

- `zac-voice-profile.json`: synthesized only after repeated corpus evidence.
- `amm-voice-profile.json`: stable company communication behavior.
- `customer-service-principles.json`: reusable judgment rules.
- `current-business-rules.json`: the only source for changing approved business facts.
- `approved-examples.jsonl`: anonymized, human-approved examples only.
- `edge-cases.jsonl`: known failure modes.
- `eval-tests.jsonl`: synthetic regression scenarios.
- `analysis-output/`: private, ignored, review-stage corpus output.

Never copy raw Takeout data into this directory or Git.
