import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["collabtime.web.localhost", "*.collabtime.web.localhost", "*.vercel.app"],
  cacheComponents: true,
  experimental: {
    turbopackRustReactCompiler: true,
  },
  partialPrefetching: true,
  reactCompiler: true,
  transpilePackages: ["@repo/observability", "@repo/ui"],
};

export default withSentryConfig(nextConfig, {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: "unlockers-io",
  project: "collabtime-web",
  silent: false,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  // Skip the tunnel in GH Actions: the proxy fetch to Sentry's ingest
  // endpoint is unreachable from runners and hangs Playwright.
  ...(process.env.GITHUB_ACTIONS ? {} : { tunnelRoute: "/monitoring" }),
  widenClientFileUpload: true,
});
