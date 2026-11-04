---
title: 'Local Playwright runs against a production build fail sign-in with 429 unless CI is set'
severity: 'minor'
---

## Expected Behavior

`pnpm test:e2e` against a local production build (`next build` + `next start`) passes the same way it does in CI.

## Current Behavior

`packages/auth/src/env-config.ts` enables Better Auth's rate limit whenever `NODE_ENV=production` and `CI` is unset, so parallel specs get `429` from `/api/auth/sign-in/email` and 23 of 46 fail. The `instant()` specs also need `EXPOSE_TESTING_API=1` at build time, and the auth-email specs need the Resend stub that only the CI `webServer` block starts. None of this is written down.

## Possible Solution

Document the local recipe in `AGENTS.md`, or add a `test:e2e:local` script that builds with `CI=true EXPOSE_TESTING_API=1 NEXT_PUBLIC_DISABLE_SENTRY=true` and runs Playwright with `CI=true` plus the `RESEND_*` stub variables from `.github/workflows/e2e.yml`.

## Minimal Reproducible Example

`pnpm --filter @repo/web build && pnpm --filter @repo/web start`, then `WEB_APP_URL=http://localhost:3000 pnpm exec playwright test --project=chromium`: sign-in fixtures fail with `Expected: 200, Received: 429`.

## Context

Found while verifying the Skullet loading states locally, with Actions billing out.
