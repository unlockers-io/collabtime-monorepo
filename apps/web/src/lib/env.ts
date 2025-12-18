import { z } from "zod";

/**
 * Define environment variable schema.
 * This validates that all required environment variables are set
 * and have the correct format.
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Better Auth
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),

  // Web App URL (for redirects, etc.)
  WEB_APP_URL: z.string().url("WEB_APP_URL must be a valid URL").optional(),

  // Stripe
  STRIPE_SECRET_KEY: z
    .string()
    .startsWith("sk_", "STRIPE_SECRET_KEY must start with 'sk_'"),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .startsWith("whsec_", "STRIPE_WEBHOOK_SECRET must start with 'whsec_'"),
  STRIPE_PRO_PRICE_ID: z
    .string()
    .startsWith("price_", "STRIPE_PRO_PRICE_ID must start with 'price_'"),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z
    .string()
    .url("UPSTASH_REDIS_REST_URL must be a valid URL"),
  UPSTASH_REDIS_REST_TOKEN: z
    .string()
    .min(1, "UPSTASH_REDIS_REST_TOKEN is required"),

  // Optional: Space access signing (falls back to BETTER_AUTH_SECRET)
  SPACE_ACCESS_SECRET: z.string().min(32).optional(),

  // Optional: Resend email
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),

  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables.
 * Call this at application startup to fail fast if config is missing.
 */
const validateEnv = (): Env => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error("❌ Invalid environment variables:\n" + errors);
    throw new Error("Invalid environment variables. See above for details.");
  }

  return result.data;
};

/**
 * Get a validated environment variable.
 * Use this instead of directly accessing process.env for type safety.
 */
const getEnv = <K extends keyof Env>(key: K): Env[K] => {
  const value = process.env[key];

  // For optional values, return undefined
  if (value === undefined) {
    return undefined as Env[K];
  }

  return value as Env[K];
};

/**
 * Check if all required environment variables are set.
 * Returns true if valid, false otherwise. Does not throw.
 */
const isEnvValid = (): boolean => {
  const result = envSchema.safeParse(process.env);
  return result.success;
};

export { validateEnv, getEnv, isEnvValid, envSchema };
export type { Env };
