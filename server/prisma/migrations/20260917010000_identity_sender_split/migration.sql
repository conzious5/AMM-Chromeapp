ALTER TABLE "AnalyticsEvent"
  ADD COLUMN "authenticatedUser" TEXT,
  ADD COLUMN "senderAddress" TEXT,
  ADD COLUMN "recipientAddress" TEXT;

UPDATE "AnalyticsEvent" SET "authenticatedUser" = "actorId" WHERE "authenticatedUser" IS NULL;

CREATE INDEX "AnalyticsEvent_authenticatedUser_occurredAt_idx" ON "AnalyticsEvent"("authenticatedUser", "occurredAt");
CREATE INDEX "AnalyticsEvent_senderAddress_occurredAt_idx" ON "AnalyticsEvent"("senderAddress", "occurredAt");
CREATE INDEX "AnalyticsEvent_authenticatedUser_senderAddress_occurredAt_idx" ON "AnalyticsEvent"("authenticatedUser", "senderAddress", "occurredAt");
