import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  DEV_AUTH_TOKEN: z.string().min(16).default("development-token-change-me"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  ALLOWED_ORIGINS: z.string().default(""),
  MAX_DRAFT_CHARS: z.coerce.number().int().positive().default(12_000),
  MAX_THREAD_CHARS: z.coerce.number().int().positive().default(30_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  DATABASE_URL: z.string().optional(),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(256).optional(),
  BOOTSTRAP_TEAM_PASSWORD: z.string().min(12).max(256).optional(),
  USER_SENDER_PERMISSIONS_JSON: z.string().default("{}")
});

export type AppConfig = z.infer<typeof envSchema>;
export const config = envSchema.parse(process.env);
