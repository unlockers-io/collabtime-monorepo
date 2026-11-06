import "zod/compile";

import { init, replayIntegration } from "@sentry/nextjs";

import { sentryOptions } from "./lib/sentry-options";

init({
  ...sentryOptions,
  enableLogs: true,
  integrations: [replayIntegration()],
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,
});

export { captureRouterTransitionStart as onRouterTransitionStart } from "@sentry/nextjs";
