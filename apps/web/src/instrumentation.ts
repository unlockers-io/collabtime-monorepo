// oxlint-disable no-console -- server-startup diagnostic logging; TODO migrate to structured logger
/**
 * Next.js Instrumentation file.
 * Runs once when the Next.js server starts. Validates env vars and loads the
 * runtime-specific Sentry config.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export const register = async () => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/env");

    try {
      validateEnv();
      console.log("✅ Environment variables validated successfully");
    } catch (error) {
      // Dev: warn only. Prod: crash so misconfigured deploys don't start.
      if (process.env.NODE_ENV === "production") {
        throw error;
      }
      console.warn(
        "⚠️ Environment validation failed in development mode. Some features may not work.",
      );
    }

    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
};
