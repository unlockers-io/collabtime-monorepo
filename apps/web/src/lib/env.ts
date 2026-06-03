import { z } from "zod";

const envSchema = z.object({
  AUTH_ALLOWED_HOSTS: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Empty string is treated as unset — unset GitHub secrets expand to "" in CI.
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL").optional().or(z.literal("")),
  // Accepts bare email or RFC 5322 "Display Name <email>" — both valid Resend sender formats.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z
    .string()
    .refine(
      (val) => {
        const wrapped = val.match(/^.+<([^<>\s]+)>$/v);
        const email = wrapped ? wrapped[1] : val;
        return z.email().safeParse(email).success;
      },
      { message: "Must be a valid email or 'Display Name <email>' format" },
    )
    .optional(),
  SPACE_ACCESS_SECRET: z.string().min(32).optional(),
  WEB_APP_URL: z.string().url("WEB_APP_URL must be a valid URL").optional(),
});

type Env = z.infer<typeof envSchema>;

const validateEnv = (): Env => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error(`❌ Invalid environment variables:\n${errors}`);
    throw new Error("Invalid environment variables. See above for details.");
  }

  return result.data;
};

const getEnv = <K extends keyof Env>(key: K): Env[K] => {
  const value = process.env[key];

  if (value === undefined) {
    return undefined as Env[K];
  }

  return value as Env[K];
};

const isEnvValid = (): boolean => {
  const result = envSchema.safeParse(process.env);
  return result.success;
};

export { validateEnv, getEnv, isEnvValid };
