---
title: "Production E2E auth setup creates invalid browser cookies"
severity: "major"
---

## What happened

The production Playwright run starts the built Next.js server, but `tests/e2e/setup/auth.setup.ts` fails at `browserContext.addCookies()` with `Protocol error (Storage.setCookies): Invalid cookie fields`. The setup retries twice and route tests never run.

## Impact

Production route and instant-navigation checks cannot reach their assertions, even though lint, typecheck, unit tests, and the partial-prerender production build pass.

## Reproduction

Run `CI=1 pnpm exec playwright test tests/e2e/auth/login.spec.ts --project chromium --grep "login shell"`.

## Expected

The auth setup should normalize Better Auth response cookies into fields accepted by Playwright for the configured base URL.
