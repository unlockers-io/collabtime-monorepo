import { defineConfig } from "oxlint";
import awesomeness from "oxlint-config-awesomeness";

export default defineConfig({
  extends: [awesomeness],
  overrides: [
    {
      files: ["apps/**/src/app/**/layout.tsx"],
      rules: {
        // next/font/google fonts are factory calls (`Inter({...})`), not constructors
        "new-cap": "off",
      },
    },
    {
      files: ["apps/**/src/components/analytics.tsx"],
      rules: {
        // next/dynamic requires .then() to remap a named export onto `default`
        "promise/prefer-await-to-then": "off",
      },
    },
    {
      // Design system variants (size, intent, etc.) order semantically, not alphabetically
      files: ["packages/ui/src/**"],
      rules: {
        "perfectionist/sort-jsx-props": "off",
        "perfectionist/sort-objects": "off",
      },
    },
    {
      // Large product components pending refactor into focused submodules
      files: [
        "apps/web/src/app/**/client.tsx",
        "apps/web/src/app/home-client.tsx",
        "apps/web/src/components/import-members-dialog.tsx",
        "apps/web/src/components/nav.tsx",
        "apps/web/src/components/timezone-visualizer.tsx",
      ],
      rules: {
        "max-lines": "off",
      },
    },
    {
      // Server-side error/diagnostic logging — pending migration to a structured logger
      files: [
        "apps/web/src/app/api/**/*.ts",
        "apps/web/src/app/error.tsx",
        "apps/web/src/instrumentation.ts",
        "apps/web/src/lib/actions/**/*.ts",
        "apps/web/src/lib/email.ts",
        "apps/web/src/lib/env.ts",
        "apps/web/src/lib/space-access.ts",
      ],
      rules: {
        "no-console": "off",
      },
    },
  ],
});
