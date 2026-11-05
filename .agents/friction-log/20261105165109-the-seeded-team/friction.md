---
title: 'The seeded team never loads because db:seed writes it to Redis and leaves the Space retention columns null'
severity: 'minor'
---

### Expected Behavior

After `pnpm db:seed`, signing in as `test@collabtime.dev` and opening `/00000000-0000-4000-8000-000000000001` shows the seeded team.

### Current Behavior

The team page shows its skeleton while `getPublicTeam` keeps answering "Team not found". `packages/db/src/seed.ts` stores the team JSON under `team:<id>` in Redis and upserts the `Space` without `teamCreatedAt` or `teamExpiresAt`, but teams now live in Postgres, and `readTeams` in `apps/web/src/lib/team-postgres-repository.ts` only returns spaces with `teamCreatedAt` set and `teamExpiresAt` in the future.

### Possible Solution

Have the seed write the team through the Postgres repository (or set `teamCreatedAt` and `teamExpiresAt` on the `Space` and create its `TeamMember` and `TeamGroup` rows), and drop the Redis write.

### Minimal Reproducible Example

Run `pnpm db:push && pnpm db:seed`, start the web app, sign in as `test@collabtime.dev` / `TestPassword123!`, and open the seeded team's URL.

### Context

Found while checking the team page skeleton for the Skullet migration. Worked around by setting `teamCreatedAt` and `teamExpiresAt` on an existing local space with SQL.
