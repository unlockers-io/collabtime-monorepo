// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import { init } from "@sentry/nextjs";

init({
  dsn: "https://bd738ae5e6e5e0cef0d00e240b17601b@o4507617812938752.ingest.us.sentry.io/4511229832396800",

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Skip GH Actions: the tunnel can't reach Sentry's ingest endpoint and
  // hangs Playwright tests. Vercel builds don't set GITHUB_ACTIONS.
  enabled: process.env.NODE_ENV === "production" && !process.env.GITHUB_ACTIONS,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,
});
