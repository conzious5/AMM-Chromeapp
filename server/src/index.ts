import { buildApp } from "./app.js";
import { config } from "./config.js";
import { LocalStyleRepository } from "./repositories/LocalStyleRepository.js";
import { CompositeAuth, DevelopmentTokenAuth, SignedTokenAuth } from "./services/auth.js";
import { OpenAIResponsesModel } from "./services/OpenAIResponsesModel.js";
import { RewriteService } from "./services/rewriteService.js";
import { AnalyticsRepository } from "./services/analyticsRepository.js";

if (!config.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required to start the server.");
const model = new OpenAIResponsesModel(config.OPENAI_API_KEY, config.OPENAI_MODEL);
const analytics = new AnalyticsRepository(config.DATABASE_URL);
const app = await buildApp({
  config,
  auth: new CompositeAuth([new SignedTokenAuth(config.SESSION_SECRET), new DevelopmentTokenAuth(config.DEV_AUTH_TOKEN)]),
  rewriteService: new RewriteService(new LocalStyleRepository(), model),
  analytics
});
await app.listen({ port: config.PORT, host: config.HOST });
