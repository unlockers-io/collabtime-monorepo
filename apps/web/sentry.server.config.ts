// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import { init } from "@sentry/nextjs";

init({
  dsn: "https://bd738ae5e6e5e0cef0d00e240b17601b@o4507617812938752.ingest.us.sentry.io/4511229832396800",

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Skip GH Actions: the tunnel can't reach Sentry's ingest endpoint and
  // hangs Playwright tests. Vercel builds don't set GITHUB_ACTIONS.
  enabled: process.env.NODE_ENV === "production" && !process.env.GITHUB_ACTIONS,

  // Uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: process.env.NODE_ENV === 'development',

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,
});
