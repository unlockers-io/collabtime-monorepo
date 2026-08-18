import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["collabtime.web.localhost", "*.collabtime.web.localhost", "*.vercel.app"],
  cacheComponents: true,
  experimental: {
    exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === "1",
    instantInsights: { validationLevel: "manual-warning" },
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
  tunnelRoute: process.env.GITHUB_ACTIONS ? undefined : "/monitoring",
  widenClientFileUpload: true,
});
