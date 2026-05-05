import { defineConfig } from "oxlint";
import awesomeness from "oxlint-config-awesomeness";

export default defineConfig({
  extends: [awesomeness],
  overrides: [
    // Server-side code without a structured logger yet — `console.*` is the
    // pragmatic surface for diagnostics until a logger lands.
    {
      files: [
        "apps/web/src/instrumentation.ts",
        "apps/web/src/lib/env.ts",
        "apps/web/src/lib/space-access.ts",
        "apps/web/src/lib/actions/**/*.ts",
        "apps/web/src/app/api/**/*.ts",
        "packages/auth/src/**/*.ts",
      ],
      rules: {
        "no-console": "off",
      },
    },
    // Client-side error/diagnostic surfaces — error boundaries and auth
    // failures still need to reach the console until logging lands.
    {
      files: [
        "apps/web/src/app/error.tsx",
        "apps/web/src/app/(dashboard)/settings/client.tsx",
        "apps/web/src/components/nav/user-menu.tsx",
      ],
      rules: {
        "no-console": "off",
      },
    },
    // Inline-edit inputs that mount on a user gesture (click "Edit" → render
    // input) — focusing immediately matches user expectation and isn't a
    // surprise focus jump.
    {
      files: [
        "apps/web/src/components/group-card.tsx",
        "apps/web/src/components/nav/team-title.tsx",
      ],
      rules: {
        "jsx-a11y/no-autofocus": "off",
      },
    },
    // Design-system primitives — CVA variant maps order semantically
    // (default first, sizes ascending, etc.) rather than alphabetically.
    {
      files: ["packages/ui/src/components/badge.tsx", "packages/ui/src/components/button.tsx"],
      rules: {
        "perfectionist/sort-jsx-props": "off",
        "perfectionist/sort-objects": "off",
      },
    },
    // Generic Label wrapper — `htmlFor` is forwarded via `...props`, so the
    // associated-control link lives in the caller, not this file.
    {
      files: ["packages/ui/src/components/label.tsx"],
      rules: {
        "jsx-a11y/label-has-associated-control": "off",
      },
    },
    // next/font factories (Geist_Mono, Inter, etc.) and Intl.DateTimeFormat
    // are callable without `new` — the rule's PascalCase heuristic
    // misclassifies them as constructors.
    {
      files: ["apps/web/src/app/layout.tsx", "apps/web/src/lib/timezones.ts"],
      rules: {
        "new-cap": "off",
      },
    },
    // Inline FOUC bootstrap script in the root layout writes literal HTML
    // (no user data) to set the theme class before paint.
    {
      files: ["apps/web/src/app/layout.tsx"],
      rules: {
        "react/no-danger": "off",
      },
    },
    // Email senders present an async API to callers (the `Promise` is part of
    // the contract); React's render itself is sync.
    {
      files: ["packages/transactional/src/utils/senders.ts"],
      rules: {
        "require-await": "off",
      },
    },
    // E2E teardown scripts: `console.*` output is the whole point, and the
    // Redis SCAN loop is sequential by design (each page needs the previous
    // cursor).
    {
      files: ["tests/e2e/teardown/**/*.ts"],
      rules: {
        "no-await-in-loop": "off",
        "no-console": "off",
      },
    },
    // Playwright fixture signature requires `({}, use) =>` — the rule flags
    // the empty pattern but the shape is non-negotiable.
    {
      files: ["tests/e2e/fixtures/**/*.ts"],
      rules: {
        "no-empty-pattern": "off",
      },
    },
  ],
});
