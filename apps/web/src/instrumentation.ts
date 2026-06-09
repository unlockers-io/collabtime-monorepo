import { defineNodeInstrumentation } from "@repo/observability/next/instrumentation";

// Lazily loads the Node-only observability instance so the edge bundle never
// pulls `node:async_hooks`. Provides evlog's wide-event `register` + the
// `onRequestError` hook Next.js calls for uncaught App Router errors.
const evlog = defineNodeInstrumentation(() => import("./lib/observability"));

/**
 * Next.js Instrumentation file.
 * Runs once when the Next.js server starts. Initializes evlog wide-event
 * logging, validates env vars, and loads the runtime-specific Sentry config.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
const register = async () => {
  // evlog's instrumentation gates its Node-only setup off the edge runtime.
  await evlog.register();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/env");
    const { log } = await import("./lib/observability");

    try {
      validateEnv();
      log.info("instrumentation", "Environment variables validated successfully");
    } catch (error) {
      // Dev: warn only. Prod: crash so misconfigured deploys don't start.
      if (process.env.NODE_ENV === "production") {
        throw error;
      }
      log.warn({
        error,
        message: "Environment validation failed in development mode",
        route: "instrumentation",
      });
    }

    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
};

const onRequestError = evlog.onRequestError;

export { onRequestError, register };
