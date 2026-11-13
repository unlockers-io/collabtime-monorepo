import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

import reactConfig from "@repo/config-vitest/react";
import { defineConfig, mergeConfig } from "vitest/config";

const monorepoRoot = resolve(import.meta.dirname, "../..");

const sentryClientEntry = resolve(
  dirname(createRequire(import.meta.url).resolve("@sentry/nextjs/package.json")),
  "build/cjs/index.client.js",
);

export default mergeConfig(
  reactConfig,
  defineConfig({
    resolve: {
      alias: [
        { find: "@", replacement: new URL("src", import.meta.url).pathname },
        { find: "react", replacement: resolve(monorepoRoot, "node_modules/react") },
        { find: "react-dom", replacement: resolve(monorepoRoot, "node_modules/react-dom") },
        { find: /^@sentry\/nextjs$/v, replacement: sentryClientEntry },
      ],
    },
    test: {
      globalSetup: ["./src/test/postgres-global-setup.ts"],
      setupFiles: ["./src/test/postgres-worker.ts"],
    },
  }),
);
