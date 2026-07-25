import { init, replayIntegration } from "@sentry/nextjs";

init({
  dsn: "https://bd738ae5e6e5e0cef0d00e240b17601b@o4507617812938752.ingest.us.sentry.io/4511229832396800",
  enableLogs: true,
  // NEXT_PUBLIC_ inlines into the client bundle; GH Actions disables Sentry to avoid hanging Playwright.
  enabled: process.env.NEXT_PUBLIC_DISABLE_SENTRY !== "true",
  integrations: [replayIntegration()],
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  // frameContextLines must stay 7, not the documented default 5: the legacy
  // sendDefaultPii bridge applied 7, and dropping to 5 would change what
  // reaches Sentry after the deprecated flag's removal in v11.
  dataCollection: {
    cookies: true,
    frameContextLines: 7,
    genAI: { inputs: true, outputs: true },
    httpBodies: ["incomingRequest", "outgoingRequest", "incomingResponse", "outgoingResponse"],
    httpHeaders: { request: true, response: true },
    queryParams: true,
    stackFrameVariables: true,
    userInfo: true,
  },
  tracesSampleRate: 1,
});

export { captureRouterTransitionStart as onRouterTransitionStart } from "@sentry/nextjs";
