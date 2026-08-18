import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["collabtime.web.localhost", "*.collabtime.web.localhost", "*.vercel.app"],
  cacheComponents: true,
  experimental: { turbopackRustReactCompiler: true },
  partialPrefetching: true,
  reactCompiler: true,
  transpilePackages: ["@repo/observability", "@repo/ui"],
  turbopack: {
    rules: {
      "*.{ts,tsx}": {
        // Turbopack rejects Unicode RegExp flags.
        // oxlint-disable-next-line eslint/require-unicode-regexp
        condition: { all: [{ not: "foreign" }, { content: /[Zz]od/ }] },
        loaders: ["zod-compiler/turbopack"],
      },
    },
  },
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
