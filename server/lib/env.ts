import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/resident_vote?schema=public"),
  SESSION_SECRET: z.string().min(32).default("development-session-secret-that-is-at-least-32-chars"),
  OTP_SMS_PROVIDER: z.enum(["twilio", "vonage"]).default("twilio"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
  VONAGE_API_KEY: z.string().optional(),
  VONAGE_API_SECRET: z.string().optional(),
  VONAGE_FROM_NUMBER: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_TRANSLATION_MODEL: z.string().optional(),
  // Bootstrap credentials are used by seed scripts; keep runtime parsing permissive.
  ADMIN_BOOTSTRAP_EMAIL: z.string().default("admin"),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().default("ChangeMe123!")
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  OTP_SMS_PROVIDER: process.env.OTP_SMS_PROVIDER,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
  TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID,
  VONAGE_API_KEY: process.env.VONAGE_API_KEY,
  VONAGE_API_SECRET: process.env.VONAGE_API_SECRET,
  VONAGE_FROM_NUMBER: process.env.VONAGE_FROM_NUMBER,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_TRANSLATION_MODEL: process.env.OPENAI_TRANSLATION_MODEL,
  ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL,
  ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD
});

export const isProduction = env.NODE_ENV === "production";
