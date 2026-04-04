import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/resident_vote?schema=public"),
  SESSION_SECRET: z.string().min(32).default("development-session-secret-that-is-at-least-32-chars"),
  WEBAUTHN_RP_ID: z.string().min(1).default("localhost"),
  WEBAUTHN_RP_NAME: z.string().min(1).default("Resident Vote"),
  WEBAUTHN_ORIGINS: z.string().min(1).default("http://localhost:3000"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_TRANSLATION_MODEL: z.string().optional(),
  // Bootstrap credentials are used by seed scripts; keep runtime parsing permissive.
  ADMIN_BOOTSTRAP_EMAIL: z.string().default("admin"),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().default("ChangeMe123!")
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  WEBAUTHN_RP_ID: process.env.WEBAUTHN_RP_ID,
  WEBAUTHN_RP_NAME: process.env.WEBAUTHN_RP_NAME,
  WEBAUTHN_ORIGINS: process.env.WEBAUTHN_ORIGINS,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_TRANSLATION_MODEL: process.env.OPENAI_TRANSLATION_MODEL,
  ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL,
  ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD
});

export const isProduction = env.NODE_ENV === "production";
