import { defineNodeInstrumentation } from "@repo/observability/next/instrumentation";

// Lazy init: keeps `node:async_hooks` out of the edge bundle.
const evlog = defineNodeInstrumentation(() => import("./lib/observability"));

const register = async () => {
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
