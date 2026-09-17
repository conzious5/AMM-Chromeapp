import { buildApp } from "./app.js";
import { config } from "./config.js";
import { LocalStyleRepository } from "./repositories/LocalStyleRepository.js";
import { CompositeAuth, DevelopmentTokenAuth } from "./services/auth.js";
import { OpenAIResponsesModel } from "./services/OpenAIResponsesModel.js";
import { RewriteService } from "./services/rewriteService.js";
import { AnalyticsRepository } from "./services/analyticsRepository.js";
import { PrismaClient } from "@prisma/client";
import { bootstrapConfiguredUsers, NativeAuthService } from "./services/nativeAuth.js";

if (!config.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required to start the server.");
if (!config.DATABASE_URL) throw new Error("DATABASE_URL is required to start the server.");
const model = new OpenAIResponsesModel(config.OPENAI_API_KEY, config.OPENAI_MODEL);
const analytics = new AnalyticsRepository(config.DATABASE_URL);
const prisma = new PrismaClient({ datasources: { db: { url: config.DATABASE_URL } } });
const nativeAuth = new NativeAuthService(prisma);
const bootstrapped = await bootstrapConfiguredUsers(nativeAuth, {
  ...(config.BOOTSTRAP_ADMIN_PASSWORD ? { adminPassword: config.BOOTSTRAP_ADMIN_PASSWORD } : {}),
  ...(config.BOOTSTRAP_TEAM_PASSWORD ? { teamPassword: config.BOOTSTRAP_TEAM_PASSWORD } : {})
});
if (bootstrapped.length) console.info({ users: bootstrapped }, "Bootstrapped native AMM Voice users. Remove bootstrap password variables and redeploy.");
const authServices = config.NODE_ENV === "production" ? [nativeAuth] : [nativeAuth, new DevelopmentTokenAuth(config.DEV_AUTH_TOKEN)];
const app = await buildApp({
  config,
  auth: new CompositeAuth(authServices),
  nativeAuth,
  rewriteService: new RewriteService(new LocalStyleRepository(), model),
  analytics
});
app.addHook("onClose", async () => { await prisma.$disconnect(); });
await app.listen({ port: config.PORT, host: config.HOST });
