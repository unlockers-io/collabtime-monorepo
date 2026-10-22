---
title: 'Committing only a frog entry fails the pre-commit hook'
severity: 'minor'
---

## Expected Behavior

Committing a new `.agents/friction-log/<id>/friction.md` on its own passes the husky pre-commit hook, so logging friction with `npx frog log` never needs `--no-verify`.

## Current Behavior

lint-staged runs `oxfmt` on staged `*.md` files, but `.oxfmtrc.json` ignores `.agents/friction-log/**`. When the friction entry is the only staged file, oxfmt gets no targets and exits with "Expected at least one target file. All matched files may have been excluded by ignore rules.", which fails the hook.

## Possible Solution

Run `oxfmt --no-error-on-unmatched-pattern` from the `lint-staged` config in `package.json`.

## Minimal Reproducible Example

Run `npx frog log "<title>" --body "<body>"`, stage only the new entry, and run `git commit`.

## Context

Hit while committing friction found during the form validation migration.
