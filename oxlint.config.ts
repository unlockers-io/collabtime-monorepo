import { defineConfig } from "oxlint";
import awesomeness from "oxlint-config-awesomeness";

export default defineConfig({
  extends: [awesomeness],
  overrides: [
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
      files: ["apps/web/src/lib/actions/join-requests.ts"],
      rules: {
        "react-doctor/server-auth-actions": "off",
      },
    },
    {
      files: ["apps/web/src/app/home-client/archived-teams-list.tsx"],
      rules: {
        "react-doctor/no-layout-property-animation": "off",
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
});
