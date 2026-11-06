import "zod/compile";

import { defineNodeInstrumentation } from "@repo/observability/next/instrumentation";
import { captureRequestError } from "@sentry/nextjs";

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

const onRequestError = async (...args: Parameters<typeof evlog.onRequestError>) => {
  captureRequestError(...args);
  await evlog.onRequestError(...args);
};

export { onRequestError, register };
