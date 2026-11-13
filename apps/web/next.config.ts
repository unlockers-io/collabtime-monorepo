import { baseNextConfig, securityHeaders } from "@repo/config-next";
import { applyPortlessUrls } from "@repo/portless-env";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

applyPortlessUrls(["WEB_APP_URL"]);

const WORKSPACE_ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const nextConfig: NextConfig = {
  ...baseNextConfig("web", {
    exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === "1",
    instantInsights: { validationLevel: "manual-warning" },
  }),
  agentRules: false,
  headers: () =>
    Promise.resolve([
      {
        headers: [
          ...securityHeaders,
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
        source: "/:path*",
      },
    ]),
  redirects: () =>
    Promise.resolve([{ destination: "/register", permanent: true, source: "/signup" }]),
  rewrites: () =>
    Promise.resolve({
      // No route lives under /404/, so Next answers with not-found.tsx and a real 404.
      afterFiles: [{ destination: "/404/:path", source: `/:path((?!${WORKSPACE_ID}$)[^/]+)` }],
      beforeFiles: [],
      fallback: [],
    }),
  transpilePackages: ["@repo/observability", "@repo/ui"],
  turbopack: {
    rules: {
      "*.{ts,tsx}": {
        condition: {
          all: [{ not: "foreign" }, { content: /[Zz]od/ }],
        },
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
