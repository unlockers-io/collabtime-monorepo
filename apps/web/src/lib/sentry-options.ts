/** Shared by the browser, Node and edge Sentry clients. A DSN is public by design. */
const sentryOptions = {
  dsn: "https://bd738ae5e6e5e0cef0d00e240b17601b@o4507617812938752.ingest.us.sentry.io/4511229832396800",
  enabled:
    process.env.NODE_ENV === "production" &&
    process.env.GITHUB_ACTIONS !== "true" &&
    process.env.NEXT_PUBLIC_DISABLE_SENTRY !== "true",
  tracesSampleRate: 0.1,
};

export { sentryOptions };
