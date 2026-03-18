import { defineConfig } from "oxlint";
import awesomeness from "oxlint-config-awesomeness";

const config = defineConfig({
  extends: [awesomeness],
  ignorePatterns: [
    ".next/**",
    "**/generated/**",
    "build/**",
    "coverage/**",
    "dist/**",
    "next-env.d.ts",
    "node_modules/**",
  ],
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**"],
      rules: { "@typescript-eslint/no-explicit-any": "off" },
    },
    {
      files: ["**/seed.ts"],
      rules: { "no-console": "off" },
    },
    {
      // Radix UI requires namespace imports (import * as Primitive from "@radix-ui/...")
      // to access sub-components. shadcn components put data-slot first for CSS
      // targeting, and follow React convention of children before className in
      // destructuring. These are intentional patterns, not style violations.
      files: ["packages/ui/src/**"],
      rules: {
        "import/no-namespace": "off",
        "perfectionist/sort-jsx-props": "off",
        "perfectionist/sort-objects": "off",
      },
    },
    {
      // Application code: console usage is acceptable for server logs and API
      // routes. JSX prop and object ordering in app code would require touching
      // every component; enforce on new code via IDE instead.
      files: ["apps/web/src/**"],
      rules: {
        "no-console": "off",
        "perfectionist/sort-jsx-props": "off",
        "perfectionist/sort-objects": "off",
      },
    },
  ],
});

export default config;
