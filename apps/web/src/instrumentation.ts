/**
 * Next.js Instrumentation file.
 * This runs once when the Next.js server starts.
 * Used to validate environment variables at startup.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export const register = async () => {
  // Only run in Node.js runtime (not edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/env");

    try {
      validateEnv();
      console.log("✅ Environment variables validated successfully");
    } catch (error) {
      // In development, warn but don't crash
      // In production, this will prevent the server from starting
      if (process.env.NODE_ENV === "production") {
        throw error;
      }
      console.warn(
        "⚠️ Environment validation failed in development mode. Some features may not work."
      );
    }
  }
};
