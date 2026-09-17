# Importing Zac's sent email corpus

Direct Gmail access is not required for Phase 1. The supported path is Google Takeout:

1. Export Gmail mail data from each source account.
2. Keep the resulting `.mbox` files outside Git.
3. Run `pnpm analyze:takeout -- --input /absolute/path/to/mail.mbox --sender zacfabian@weddingvideoscolorado.com --sender info@weddingvideoscolorado.com`.
4. Review the private output under `server/data/analysis-output/`.
5. Manually approve and further anonymize strong examples before copying them into `approved-examples.jsonl`.

The importer only considers messages sent by an allowed sender, removes signatures and quoted history, filters obvious automated or low-information messages, and pairs each sent message with a prior external message sharing the same normalized subject. This is a conservative heuristic: all pairs require human review.

If direct Gmail access is later enabled, use a read-only Gmail integration scoped to the two accounts and fetch only sent-message threads. Do not request send or modify permissions for corpus analysis.
