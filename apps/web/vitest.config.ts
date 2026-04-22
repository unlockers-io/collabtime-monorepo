import { resolve } from "node:path";

import reactConfig from "@repo/config-vitest/react";
import { defineConfig, mergeConfig } from "vitest/config";

const monorepoRoot = resolve(import.meta.dirname, "../..");

export default mergeConfig(
  reactConfig,
  defineConfig({
    resolve: {
      alias: {
        "@": new URL("src", import.meta.url).pathname,
        react: resolve(monorepoRoot, "node_modules/react"),
        "react-dom": resolve(monorepoRoot, "node_modules/react-dom"),
      },
    },
  }),
);
