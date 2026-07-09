import { init } from "@sentry/nextjs";

init({
  debug: false,
  dsn: "https://bd738ae5e6e5e0cef0d00e240b17601b@o4507617812938752.ingest.us.sentry.io/4511229832396800",
  // GH Actions can't reach Sentry's ingest endpoint through the tunnel and hangs Playwright tests.
  enabled: process.env.NODE_ENV === "production" && !process.env.GITHUB_ACTIONS,
  tracesSampleRate: 1,
});
