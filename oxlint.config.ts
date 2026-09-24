import { defineConfig } from "oxlint";
import awesomeness from "oxlint-config-awesomeness";

export default defineConfig({
  extends: [awesomeness],
  // Generated runtime is byte-verified and tested in the control plane.
  ignorePatterns: [".github/ci/*.mjs"],
  jsPlugins: ["@shadcn/lint"],
  overrides: [
    {
      // Next route entrypoints and client hooks require their framework context; mock that boundary, not the behavior under test.
      files: [
        "apps/web/src/app/[[]teamId]/page.test.tsx",
        "apps/web/src/app/home-client/lists.test.tsx",
        "apps/web/src/components/accept-workspace-invitation.test.tsx",
        "apps/web/src/app/(auth)/auth-gate.test.tsx",
      ],
      rules: { "anti-slop/no-module-mocking": "off" },
    },
    {
      files: [
        "apps/web/src/components/group-card.tsx",
        "apps/web/src/components/nav/team-title.tsx",
      ],
      rules: {
        "jsx-a11y/no-autofocus": "off",
      },
    },
    {
      files: ["packages/ui/src/components/badge.tsx", "packages/ui/src/components/button.tsx"],
      rules: {
        "perfectionist/sort-jsx-props": "off",
        "perfectionist/sort-objects": "off",
      },
    },
    {
      files: ["packages/ui/src/components/label.tsx"],
      rules: {
        "jsx-a11y/label-has-associated-control": "off",
      },
    },
    {
      files: ["packages/ui/src/components/field.tsx", "packages/ui/src/components/spinner.tsx"],
      rules: {
        "jsx-a11y/prefer-tag-over-role": "off",
      },
    },
    {
      files: [
        "apps/web/src/components/add-member-dialog.tsx",
        "apps/web/src/components/edit-member-dialog.tsx",
      ],
      rules: {
        "max-lines": "off",
      },
    },
    {
      files: ["apps/web/src/app/layout.tsx", "apps/web/src/lib/timezones.ts"],
      rules: {
        "new-cap": "off",
      },
    },
    {
      files: ["apps/web/src/app/layout.tsx"],
      rules: {
        "react/no-danger": "off",
      },
    },
    {
      files: ["packages/transactional/src/utils/senders.ts"],
      rules: {
        "require-await": "off",
      },
    },
    {
      files: [
        "apps/web/src/lib/actions/group-actions.ts",
        "apps/web/src/lib/actions/member-actions.ts",
      ],
      rules: {
        "require-await": "off",
      },
    },
    {
      // These server exports delegate authorization to their tested action cores.
      files: [
        "apps/web/src/lib/actions/join-requests.ts",
        "apps/web/src/lib/actions/invitation-actions.ts",
      ],
      rules: {
        "react-doctor/server-auth-actions": "off",
      },
    },
    {
      files: ["tests/e2e/teardown/**/*.ts", "apps/web/scripts/**/*.ts"],
      rules: {
        "no-console": "off",
      },
    },
    {
      files: ["tests/e2e/fixtures/**/*.ts"],
      rules: {
        "no-empty-pattern": "off",
      },
    },
    {
      files: ["tests/**", "playwright.config.ts"],
      rules: {
        "require-unicode-regexp": "off",
      },
    },
  ],
  rules: {
    "shadcn/no-arbitrary-values": "error",
    "shadcn/no-inline-styles": "error",
    "shadcn/no-raw-colors": "error",
    "shadcn/no-restyle": [
      "error",
      {
        allow: ["layout"],
        contracts: [
          { allow: ["layout", "shape", "color"], pattern: "^Skeleton$" },
          { allow: ["layout", "spacing"], pattern: "^Card$" },
          { allow: ["layout", "gap-*"], pattern: "^(DialogTitle|DropdownMenuItem|ScrollArea)$" },
          {
            allow: ["layout", "typography"],
            deny: ["font-*"],
            pattern: "^CardTitle$",
          },
          {
            allow: ["layout", "spacing"],
            pattern: "^CardContent$",
          },
        ],
      },
    ],
    "shadcn/no-unknown-classes": "error",
    "shadcn/require-static-classes": "error",
  },
  settings: { shadcn: { ui: "@repo/ui/components" } },
});
