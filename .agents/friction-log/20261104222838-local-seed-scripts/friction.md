---
title: 'Local seed scripts do not find REDIS_URL or DATABASE_URL in apps/web/.env'
severity: 'minor'
---

## Expected Behavior

`pnpm db:seed` and `pnpm --filter @repo/web exec tsx scripts/ensure-e2e-user.ts` run against the local stack once `apps/web/.env` and `packages/db/.env` are filled in from their examples.

## Current Behavior

`packages/db/src/seed.ts` asserts `REDIS_URL` points at localhost, but `packages/db/.env.example` has no `REDIS_URL`, so the seed stops with "Refusing to seed: REDIS_URL must point at localhost." `ensure-e2e-user.ts` loads no env file at all and stops with "DATABASE_URL points at an unparsable URL, not localhost."

## Possible Solution

Add `REDIS_URL` to `packages/db/.env.example`, and run `ensure-e2e-user.ts` with `tsx --env-file=.env` (or import `dotenv/config` as `prisma.config.ts` does).

## Minimal Reproducible Example

Copy both `.env.example` files, start `docker compose up -d`, run `pnpm db:push && pnpm db:seed`.

## Context

Found while seeding a worktree to verify the Skullet loading states. Worked around with `REDIS_URL=redis://localhost:6391 pnpm db:seed` and `pnpm exec tsx --env-file=.env scripts/ensure-e2e-user.ts`.
