CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TEAM');
CREATE TYPE "DataSource" AS ENUM ('LIVE', 'HISTORICAL_CORPUS');

CREATE TABLE "AnalyticsEvent" (
  "id" TEXT NOT NULL, "requestId" TEXT NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT NOT NULL, "mode" TEXT NOT NULL, "source" "DataSource" NOT NULL DEFAULT 'LIVE',
  "conversationRef" TEXT, "scenarioCategory" TEXT, "clientContactCategory" TEXT, "latencyMs" INTEGER,
  "model" TEXT, "inputTokens" INTEGER, "outputTokens" INTEGER, "accepted" BOOLEAN,
  "modifiedAfterGeneration" BOOLEAN, "regenerated" BOOLEAN NOT NULL DEFAULT false,
  "questionCount" INTEGER, "questionsAnswered" INTEGER, "questionsMissed" INTEGER,
  "warnings" TEXT[], "interventions" TEXT[], "frictionSignals" TEXT[], "attentionSignals" TEXT[],
  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnalyticsEvent_requestId_key" ON "AnalyticsEvent"("requestId");
CREATE INDEX "AnalyticsEvent_occurredAt_idx" ON "AnalyticsEvent"("occurredAt");
CREATE INDEX "AnalyticsEvent_mode_occurredAt_idx" ON "AnalyticsEvent"("mode", "occurredAt");
CREATE INDEX "AnalyticsEvent_scenarioCategory_idx" ON "AnalyticsEvent"("scenarioCategory");

CREATE TABLE "ConversationSignal" (
  "id" TEXT NOT NULL, "conversationRef" TEXT NOT NULL, "source" "DataSource" NOT NULL DEFAULT 'LIVE',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "clientLabel" TEXT, "category" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open', "reason" TEXT NOT NULL, "followUpCount" INTEGER NOT NULL DEFAULT 0,
  "lastInteractionAt" TIMESTAMP(3), "attentionRequired" BOOLEAN NOT NULL DEFAULT false, "classificationNote" TEXT,
  CONSTRAINT "ConversationSignal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ConversationSignal_attentionRequired_occurredAt_idx" ON "ConversationSignal"("attentionRequired", "occurredAt");
CREATE INDEX "ConversationSignal_conversationRef_idx" ON "ConversationSignal"("conversationRef");

CREATE TABLE "Report" (
  "id" TEXT NOT NULL, "periodType" TEXT NOT NULL, "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL, "source" "DataSource" NOT NULL DEFAULT 'LIVE',
  "status" TEXT NOT NULL DEFAULT 'generated', "content" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProfileVersion" (
  "id" TEXT NOT NULL, "profileType" TEXT NOT NULL, "version" INTEGER NOT NULL, "summary" TEXT NOT NULL,
  "content" JSONB NOT NULL, "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfileVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProfileVersion_profileType_version_key" ON "ProfileVersion"("profileType", "version");
CREATE TABLE "TrainingCandidate" (
  "id" TEXT NOT NULL, "category" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'needs_review',
  "sourceRef" TEXT, "metadata" JSONB NOT NULL, "reviewedBy" TEXT, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TrainingCandidate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "actorEmail" TEXT NOT NULL,
  "action" TEXT NOT NULL, "targetType" TEXT, "targetRef" TEXT, "metadata" JSONB,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditEvent_occurredAt_idx" ON "AuditEvent"("occurredAt");
