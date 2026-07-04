import { defineConfig } from "oxlint";
import awesomeness from "oxlint-config-awesomeness";

export default defineConfig({
  extends: [awesomeness],
  overrides: [
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
    // shadcn-style primitives where the suggested tag swap doesn't apply:
    // Spinner is a lucide `<svg>` (can't become `<output>`), and Field's
    // styled `<div role="group">` can't be a `<fieldset>` (flex layout on
    // fieldset is unreliable; `FieldSet` exists separately for real fieldsets).
    {
      files: ["packages/ui/src/components/field.tsx", "packages/ui/src/components/spinner.tsx"],
      rules: {
        "jsx-a11y/prefer-tag-over-role": "off",
      },
    },
    // `add-member-dialog.tsx` is a complex multi-field form dialog that
    // crosses 400 code lines; a11y improvements (isTouched guards,
    // aria-describedby wiring) added ~20 lines. Splitting would fracture the
    // cohesive form composition pattern used across all dialogs.
    {
      files: ["apps/web/src/components/add-member-dialog.tsx"],
      rules: {
        "max-lines": "off",
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
    // Server actions wrapping `mutateTeam` must be syntactically `async` for
    // Next.js's `"use server"` directive even when the body returns a Promise
    // directly — the awaitless body is a deliberate pipeline, not an oversight.
    {
      files: [
        "apps/web/src/lib/actions/group-actions.ts",
        "apps/web/src/lib/actions/member-actions.ts",
      ],
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
    // Playwright's selector engine rejects regex literals with the /v flag
    // (e.g. `getByRole("button", { name: /sign in/iv })` fails to parse at
    // runtime). Disable `require-unicode-regexp` for files that pass regexes
    // to Playwright APIs so the regex flags Playwright accepts (/i without /v)
    // can stay.
    {
      files: ["tests/**", "playwright.config.ts"],
      rules: {
        "require-unicode-regexp": "off",
      },
    },
    // Config files resolve portless URLs at load time — module scope can't await.
    {
      files: ["playwright.config.ts", "**/next.config.ts"],
      rules: {
        "node/no-sync": "off",
      },
    },
  ],
});
