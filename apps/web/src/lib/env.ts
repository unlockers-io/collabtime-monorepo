import { z } from "zod";

import { log } from "@/lib/observability";

const envSchema = z.object({
  AUTH_ALLOWED_HOSTS: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Empty string is treated as unset: unset GitHub secrets expand to "" in CI.
  REDIS_URL: z.url("REDIS_URL must be a valid URL").optional().or(z.literal("")),
  // Accepts bare email or RFC 5322 "Display Name <email>", both valid Resend sender formats.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z
    .string()
    .refine(
      (val) => {
        const email = /^.+<(?<email>[^<>\s]+)>$/v.exec(val)?.groups?.email ?? val;
        return z.email().safeParse(email).success;
      },
      { message: "Must be a valid email or 'Display Name <email>' format" },
    )
    .optional(),
  SPACE_ACCESS_SECRET: z.string().min(32).optional(),
  WEB_APP_URL: z.url("WEB_APP_URL must be a valid URL").optional(),
});

type Env = z.infer<typeof envSchema>;

const validateEnv = (): Env => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    log.error({ message: "Invalid environment variables", route: "env", validationErrors: errors });
    throw new Error("Invalid environment variables. See above for details.");
  }

  return result.data;
};

const getEnv = <K extends keyof Env>(key: K): Env[K] => {
  // oxlint-disable-next-line no-unsafe-type-assertion -- validateEnv() has vetted process.env at boot; narrowing the raw string to Env[K] per key would require re-parsing the schema
  return process.env[key] as Env[K];
};

export { validateEnv, getEnv };
