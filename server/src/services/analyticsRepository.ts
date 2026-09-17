import { Prisma, PrismaClient, type DataSource } from "@prisma/client";

export interface AnalyticsEventInput {
  requestId: string;
  actorId: string;
  authenticatedUser: string;
  senderAddress?: string;
  recipientAddress?: string;
  mode: string;
  occurredAt?: Date;
  conversationId?: string;
  scenarioCategory?: string;
  clientContactCategory?: string;
  latencyMs?: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  warnings?: string[];
  interventions?: string[];
  frictionSignals?: string[];
  attentionSignals?: string[];
}

export interface OverviewData {
  databaseReady: boolean;
  measured: {
    emailsAnalyzed: number | null;
    ammStyleUses: number | null;
    zacsEditUses: number | null;
    unsupportedPromisesCaught: number | null;
    missingNextStepsCaught: number | null;
    conversationsNeedingAttention: number | null;
  };
  trends: Array<{ date: string; emails: number; ammStyle: number; zacsEdit: number; friction: number }>;
  interventions: Array<{ name: string; count: number }>;
  contactReasons: Array<{ name: string; count: number }>;
  attentionQueue: Array<{ id: string; client: string; reason: string; date: string; followUps: number; category: string; status: string }>;
  identityBreakdown: Array<{ authenticatedUser: string; senderAddress: string | null; count: number }>;
}

function emptyOverview(databaseReady = false): OverviewData {
  return {
    databaseReady,
    measured: { emailsAnalyzed: null, ammStyleUses: null, zacsEditUses: null, unsupportedPromisesCaught: null, missingNextStepsCaught: null, conversationsNeedingAttention: null },
    trends: [], interventions: [], contactReasons: [], attentionQueue: [], identityBreakdown: []
  };
}

export class AnalyticsRepository {
  private readonly client: PrismaClient | null;

  constructor(databaseUrl?: string) {
    this.client = databaseUrl ? new PrismaClient({ datasources: { db: { url: databaseUrl } } }) : null;
  }

  async record(event: AnalyticsEventInput): Promise<void> {
    if (!this.client) return;
    await this.client.analyticsEvent.create({ data: {
      requestId: event.requestId,
      actorId: event.actorId,
      authenticatedUser: event.authenticatedUser.toLowerCase(),
      ...(event.senderAddress ? { senderAddress: event.senderAddress.toLowerCase() } : {}),
      ...(event.recipientAddress ? { recipientAddress: event.recipientAddress.toLowerCase() } : {}),
      mode: event.mode,
      ...(event.occurredAt ? { occurredAt: event.occurredAt } : {}),
      ...(event.conversationId ? { conversationRef: event.conversationId } : {}),
      ...(event.scenarioCategory ? { scenarioCategory: event.scenarioCategory } : {}),
      ...(event.clientContactCategory ? { clientContactCategory: event.clientContactCategory } : {}),
      ...(event.latencyMs !== undefined ? { latencyMs: event.latencyMs } : {}),
      ...(event.model ? { model: event.model } : {}),
      ...(event.inputTokens !== undefined ? { inputTokens: event.inputTokens } : {}),
      ...(event.outputTokens !== undefined ? { outputTokens: event.outputTokens } : {}),
      warnings: event.warnings ?? [], interventions: event.interventions ?? [],
      frictionSignals: event.frictionSignals ?? [], attentionSignals: event.attentionSignals ?? []
    } });
  }

  async overview(days: number, source: DataSource = "LIVE", filters: { authenticatedUser?: string; senderAddress?: string } = {}): Promise<OverviewData> {
    if (!this.client) return emptyOverview(false);
    const since = new Date(Date.now() - days * 86_400_000);
    try {
      const [events, attention] = await Promise.all([
        this.client.analyticsEvent.findMany({ where: { occurredAt: { gte: since }, source, ...(filters.authenticatedUser ? { authenticatedUser: filters.authenticatedUser.toLowerCase() } : {}), ...(filters.senderAddress ? { senderAddress: filters.senderAddress.toLowerCase() } : {}) }, orderBy: { occurredAt: "asc" } }),
        this.client.conversationSignal.findMany({ where: { occurredAt: { gte: since }, source, attentionRequired: true }, orderBy: { occurredAt: "desc" }, take: 20 })
      ]);
      if (events.length === 0 && attention.length === 0) return emptyOverview(true);
      const dates = new Map<string, { date: string; emails: number; ammStyle: number; zacsEdit: number; friction: number }>();
      const interventions = new Map<string, number>();
      const reasons = new Map<string, number>();
      const identities = new Map<string, { authenticatedUser: string; senderAddress: string | null; count: number }>();
      for (const event of events) {
        const date = event.occurredAt.toISOString().slice(0, 10);
        const bucket = dates.get(date) ?? { date, emails: 0, ammStyle: 0, zacsEdit: 0, friction: 0 };
        bucket.emails += 1; bucket.ammStyle += event.mode === "amm_style" ? 1 : 0; bucket.zacsEdit += event.mode === "zacs_edit" ? 1 : 0; bucket.friction += event.frictionSignals.length;
        dates.set(date, bucket);
        for (const value of event.interventions) interventions.set(value, (interventions.get(value) ?? 0) + 1);
        if (event.clientContactCategory) reasons.set(event.clientContactCategory, (reasons.get(event.clientContactCategory) ?? 0) + 1);
        const key = `${event.authenticatedUser ?? event.actorId}\u0000${event.senderAddress ?? ""}`;
        const identity = identities.get(key) ?? { authenticatedUser: event.authenticatedUser ?? event.actorId, senderAddress: event.senderAddress, count: 0 };
        identity.count += 1; identities.set(key, identity);
      }
      const warningCount = (needle: string) => events.filter((event) => event.warnings.some((warning) => warning.toLowerCase().includes(needle))).length;
      return {
        databaseReady: true,
        measured: {
          emailsAnalyzed: events.length,
          ammStyleUses: events.filter((event) => event.mode === "amm_style").length,
          zacsEditUses: events.filter((event) => event.mode === "zacs_edit").length,
          unsupportedPromisesCaught: warningCount("commitment"),
          missingNextStepsCaught: warningCount("next step"),
          conversationsNeedingAttention: attention.length
        },
        trends: [...dates.values()],
        interventions: [...interventions].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8),
        contactReasons: [...reasons].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8),
        attentionQueue: attention.map((item) => ({ id: item.id, client: item.clientLabel ?? "Client", reason: item.reason, date: item.occurredAt.toISOString(), followUps: item.followUpCount, category: item.category ?? "Unclassified", status: item.status })),
        identityBreakdown: [...identities.values()].sort((a, b) => b.count - a.count)
      };
    } catch {
      return emptyOverview(false);
    }
  }

  async audit(actorEmail: string, action: string, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.client) return;
    await this.client.auditEvent.create({ data: { actorEmail, action, ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}) } });
  }
}
