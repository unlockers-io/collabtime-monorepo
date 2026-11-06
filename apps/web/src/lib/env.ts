import { senderAddressSchema } from "@repo/transactional/sender";
import { z } from "zod";

import { log } from "@/lib/observability";

const envSchema = z.object({
  AUTH_ALLOWED_HOSTS: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  LIVE_SYNC_ENABLED: z.enum(["true", "false"]).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  REDIS_URL: z.url("REDIS_URL must be a valid URL").optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: senderAddressSchema.optional(),
  SPACE_ACCESS_SECRET: z.string().min(32).optional(),
  WEB_APP_URL: z.url("WEB_APP_URL must be a valid URL").optional(),
});

type Env = z.infer<typeof envSchema>;

const emptyStringAsUndefined = (source: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));

const validateEnv = (): Env => {
  const result = envSchema.safeParse(emptyStringAsUndefined(process.env));

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    log.error({ message: "Invalid environment variables", route: "env", validationErrors: errors });
    throw new Error("Invalid environment variables. See above for details.");
  }

  return result.data;
};

const optionalEnvSchema = envSchema.partial();

/** Validates only `key`, so a module reading one variable doesn't depend on every other one being set. */
const getEnv = <K extends keyof Env>(key: K): Partial<Env>[K] => {
  const result = optionalEnvSchema.safeParse(emptyStringAsUndefined({ [key]: process.env[key] }));

  if (!result.success) {
    throw new Error(`Invalid ${key}: ${result.error.issues[0]?.message ?? "invalid value"}`);
  }

  return result.data[key];
};

export { validateEnv, getEnv };
