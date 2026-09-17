import { buildApp } from "./app.js";
import { config } from "./config.js";
import { LocalStyleRepository } from "./repositories/LocalStyleRepository.js";
import { DevelopmentTokenAuth } from "./services/auth.js";
import { OpenAIResponsesModel } from "./services/OpenAIResponsesModel.js";
import { RewriteService } from "./services/rewriteService.js";

if (!config.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required to start the server.");
const model = new OpenAIResponsesModel(config.OPENAI_API_KEY, config.OPENAI_MODEL);
const app = await buildApp({
  config,
  auth: new DevelopmentTokenAuth(config.DEV_AUTH_TOKEN),
  rewriteService: new RewriteService(new LocalStyleRepository(), model)
});
await app.listen({ port: config.PORT, host: config.HOST });
