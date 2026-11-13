# Open decisions

Choices about Collabtime that nobody has made yet. Each entry says what the code does today, why changing it needs a decision, the options, and what the decision unlocks. Paths are from the repo root; `~/` stands for `apps/web/src/`.

When one is decided, do it and delete its entry.

1. [Schema push on production deploys](#1-schema-push-on-production-deploys)
2. [The Redis-to-Postgres cutover and its tooling](#2-the-redis-to-postgres-cutover-and-its-tooling)
3. [The stored `order` of members and groups](#3-the-stored-order-of-members-and-groups)
4. [The `Space` row is the team](#4-the-space-row-is-the-team)
5. [Invitation expiry for old invitations](#5-invitation-expiry-for-old-invitations)
6. [Live sync: push, polling or leave](#6-live-sync-push-polling-or-leave)
7. [Rate limiting without Redis](#7-rate-limiting-without-redis)
8. [Hand-written primitives](#8-hand-written-primitives)
9. [Account name length](#9-account-name-length)
10. [Error boundaries: `reset` or `retry`](#10-error-boundaries-reset-or-retry)
11. [Request logs and the signed-in user](#11-request-logs-and-the-signed-in-user)
12. [Two e2e specs that fail now and then](#12-two-e2e-specs-that-fail-now-and-then)

## 1. Schema push on production deploys

**Today.** The repo says two things.

- `apps/web/package.json` has `vercel-build`, which runs `pnpm --filter @repo/db db:deploy` before the build. `db:deploy` in `packages/db/package.json` runs `prisma db push` against `DIRECT_DATABASE_URL` when `VERCEL_ENV` is `production` and does nothing anywhere else. `README.md` describes this as how production gets its schema.
- `apps/web/vercel.json` sets `buildCommand` to `pnpm --filter @repo/db db:generate && pnpm exec next build`, with no `db:deploy`. Vercel runs a `buildCommand` from `vercel.json` in place of the `vercel-build` script when the project's root directory is `apps/web`.

So either production pushes the schema on every deploy, or it has pushed nothing since `vercel.json` got its `buildCommand`. No schema change has merged since then, so nothing has shown which.

**Why it is open.** A deploy that pushes applies every additive change with the code that needs it, and refuses anything that loses data: the build fails and the old deployment keeps serving. A deploy that pushes nothing needs someone to run `pnpm db:push` against production before the code merges. The fleet's shared standard says a Vercel-hosted repo pushes nothing on deploy and keeps no `db:deploy` wrapper, so the first reading is also a recorded difference from it.

**What a column drop looks like when the deploy pushes.** `prisma db push` stops at "data loss" and the build fails. Do it in three steps:

1. Mark the field `@ignore` in `packages/db/prisma/schema.prisma` and merge. The generated client stops reading and writing it; the push sees no change.
2. Run the `ALTER TABLE … DROP COLUMN` by hand against production.
3. Delete the field from the schema and merge. The push finds the database already in sync.

Making a column required is the same shape: backfill by hand first, or the push refuses and the build fails (see entry 5).

**Options.**

- **Keep the production-only push (recommended).** Delete `buildCommand` from `apps/web/vercel.json` so the repo has one build command, and keep `db:deploy` with its `VERCEL_ENV` guard. Additive changes need no manual step, previews never touch production, and a destructive change fails closed. The shared standard would then describe the guard instead of forbidding the wrapper.
- **Push by hand.** Delete `vercel-build`, `db:deploy`, `DIRECT_DATABASE_URL` and the `README.md` paragraph. Matches the standard as written. Every schema change, additive ones included, needs a manual push before its code deploys, and forgetting one breaks production at runtime instead of at build time.

**Know first.** Open the build log of the latest production deployment in Vercel and look for `db:deploy` or `prisma db push`. Check Settings → Build and Deployment for the root directory and any build command override.

**Unlocks.** Entries 2, 3, 4 and 5 all end in a schema change; this decides how each one reaches production.

## 2. The Redis-to-Postgres cutover and its tooling

**Today.** Team contents (name, members, groups) are read and written in Postgres only (`~/lib/team-postgres-repository.ts`, `~/lib/team-store.ts`). Redis carries live-sync notifications, rate-limit counters and Better Auth's session cache. The tooling that moved the data from Redis is still in the tree, with the fields it carried over:

- `apps/web/scripts/cutover-team-store.ts`, `~/lib/team-record-codec.ts`, and `docs/team-store-cutover.md`, the runbook.
- `~/app/api/internal/cutover-identity/route.ts` with `~/lib/cutover-identity.ts`: a temporary probe route that ships in production, off unless `CUTOVER_IDENTITY_BEARER` and `CUTOVER_IDENTITY_EXPIRES_AT` are set (`apps/web/.env.example`).
- Two parameters only the script sets: `refreshRetention` on `readTeams` and `expiresAt` on `writeTeam`.
- `Space.adminPasswordHash`: stored, copied through, stripped before it reaches a client (`~/lib/public-team.ts`). Nothing decides anything from it.
- `Space.teamCreatedAt` and `Space.teamExpiresAt`, which copy a Redis TTL into Postgres. A space with a null `teamCreatedAt` or a past `teamExpiresAt` does not exist as far as the app can tell. A new team gets 60 days, every read or write extends it to two years (`packages/db/src/team-retention.ts`), and every read issues an `UPDATE` to do so. Nothing deletes an expired row; it only becomes unreadable.
- The e2e workflow's "Verify team transactions and cutover" step and `~/lib/team-postgres-repository.postgres.test.ts`, which run the script against a Redis service.

**Why it is open.** Deleting the tooling is only safe once the production cutover has run and been accepted, and the repo does not record that. Dropping `adminPasswordHash` loses data. Dropping the expiry changes a product rule: a team nobody opens for two years stops disappearing.

**Options.**

- **Confirm, then delete everything above (recommended).** About 650 lines, one public route, two environment variables and one CI step go. Decide team expiry at the same time: either drop `teamExpiresAt` and let teams live until their owner deletes them (recommended: an expired team is not deleted today anyway, only hidden), or keep expiry as a real feature with a job that deletes expired rows.
- **Keep the tooling.** Right only if production still reads teams from Redis somewhere or the import has not run.

**Know first.**

- Whether the import ran and was accepted. Only the maintainer knows.
- Spaces the app cannot read, on production, read-only:

  ```sql
  SELECT count(*) FILTER (WHERE "teamCreatedAt" IS NULL) AS never_imported,
         count(*) FILTER (WHERE "teamExpiresAt" <= now()) AS expired,
         count(*) AS total
  FROM "Space";
  ```

- Team keys still in Redis: `redis-cli --scan --pattern 'team:*' | wc -l` against the production instance. They are the rollback copy; delete them when the cutover is accepted.
- Whether `CUTOVER_IDENTITY_BEARER` is set in any Vercel environment.

**Unlocks.** Entry 3. The lines in `README.md`, `docs/LAUNCH.md` and `apps/web/.env.example` that still say team writes need Redis can be corrected. `packages/db/src/seed.ts` stops having to set both expiry fields by hand for the seeded team to be visible.

## 3. The stored `order` of members and groups

**Today.** `TeamMember.order` and `TeamGroup.order` are stored columns. The commands in `~/lib/team-commands.ts` keep each equal to the row's position in its list, and three places sort by it again although the rows arrive sorted: `~/app/[teamId]/client.tsx`, `~/app/[teamId]/team-workspace.tsx` and `~/lib/team-schedule.ts`.

**Why it is open.** `order` is a second copy of the list's own order, and a copy can drift. It cannot be removed from the model yet because the cutover script compares it field by field between Redis and Postgres.

**Options.**

- **Drop `order` from the model after entry 2 (recommended).** `TeamMember` and `TeamGroup` in `~/types/index.ts` lose the field, `~/lib/team-postgres-repository.ts` writes the array index into the column, and the three sorts go. The column stays; no data changes.
- **Keep it.** Nothing breaks. Every new command has to remember to renumber.

**Know first.** Teams that already hold a duplicate, read-only:

```sql
SELECT "teamId", "order", count(*)
FROM "TeamMember"
GROUP BY 1, 2
HAVING count(*) > 1
LIMIT 20;
```

Each is renumbered by its next add, removal or reorder; until then its list can change order on reload.

**Unlocks.** `reorderById` and `inOrder` in `~/lib/team-commands.ts` shrink to a plain reorder.

## 4. The `Space` row is the team

**Today.** One row has two keys. `Space.id` is a cuid and `Space.teamId` is the UUID in the URL (`packages/db/prisma/schema.prisma`). Every relation points at `teamId`; `id` is a second handle used in three places:

- The owner's routes: `PATCH` and `DELETE /api/spaces/[spaceId]`, and `POST /api/spaces/[spaceId]/verify-password` for guests (`~/app/api/spaces/`).
- The access cookie a guest gets after entering a private space's password, named `space-access-<spaceId>` (`~/lib/workspace-access.ts`), and the password attempt limit, keyed `space-verify:<spaceId>:<ip>`.
- The client, which carries both ids so the owner dialogs can call those routes. `~/lib/home-data.ts` sends `spaceId` only for teams the viewer owns, and `~/app/home-client/workspace-row.tsx` reads `spaceId !== null` as "is the owner".

`spaceId` appears in 19 source files. `GLOSSARY.md` has to explain that a space is a team's row and the UI calls it a workspace.

**Why it is open.** Keying everything by `teamId` changes two API URLs and the cookie name. A guest holding a password grant enters the password once more; signed-in people who unlocked a space are members and notice nothing. Dropping `Space.id` afterwards drops a column.

**Options.**

- **Key by `teamId`, then drop `Space.id` (recommended).** Replace the space routes with server actions that take `teamId` and authorize through `isSpaceOwner` in `~/lib/team-auth.ts`, name the cookie and the limit after `teamId`, and send the client an `isOwner` flag. That goes out as one change. The four routes the app only calls on itself (`/api/teams`, `/api/invitations`, `/api/teams/[teamId]/membership`, the space routes) and their client adapters go with it. Then make `teamId` the primary key and drop `id` and the duplicate `@@index([teamId])`, following the column-drop steps in entry 1.
- **Leave the two ids.** No user sees a difference. Every new feature on a space chooses a key again.

**Know first.** How many private spaces have a password, which bounds who re-enters one:

```sql
SELECT count(*) FROM "Space" WHERE "isPrivate" AND "accessPassword" IS NOT NULL;
```

**Unlocks.** `spaceId` leaves the client, the routes and `GLOSSARY.md`. If the token format in entry 8 is ever going to change, this is the one moment guests are signed out anyway.

## 5. Invitation expiry for old invitations

**Today.** Invitations expire 14 days after they are sent or resent. `Invitation.expiresAt` is nullable because invitations created before expiry existed have none, and null means "never expires". That rule is written at every layer: `~/lib/invitation-expiry.ts`, the Prisma filter and the raw SQL in `~/lib/invitations.ts`, the list schema in `~/lib/home-lists.ts`, and the client type in `~/types/index.ts`.

**Why it is open.** Making the column required needs a value for the old rows, and the value decides whether old invitations still work.

**Options.**

- **Backfill `createdAt + 14 days` (recommended).** Old invitations become expired, like any other invitation of their age. The recipient sees "expired"; an admin can still resend or revoke.
- **Backfill `now() + 14 days`.** Every old pending invitation gets one more fortnight.
- **Leave it nullable.** The null rule stays in five files.

**Know first.** How many rows this touches, read-only:

```sql
SELECT status, count(*) FROM "Invitation" WHERE "expiresAt" IS NULL GROUP BY status;
```

Zero pending rows means the choice between the first two does not matter.

**How it ships.** Run the `UPDATE` by hand first. With a null row left, the push in entry 1 refuses the required column and the build fails.

**Unlocks.** `expiresAt` becomes `DateTime`, and the null branch leaves about twelve files.

## 6. Live sync: push, polling or leave

**Today.** A team page learns about changes two ways. It polls: `~/hooks/use-team-query.ts` refetches every 20 seconds, or every five minutes while a live stream is up. And it holds a server-sent-events stream over Redis Pub/Sub (`~/lib/team-events.ts`, `team-event-stream.ts`, `team-event-admission.ts`, `team-event-handler.ts`, `team-live-connection.ts`, `team-live-protocol.ts`, `~/hooks/use-team-live-updates.ts`, and `GET /api/teams/[teamId]/events`). The stream is about 2,200 lines with its tests, the largest subsystem in the app. It needs 300-second functions, a Lua lease script, seven separate timeouts, a backoff table and three durations that must stay in order. `LIVE_SYNC_ENABLED=false` turns it off.

**Why it is open.** Whether a roster needs changes in under a second is a product call. Removing the stream changes what a user sees: another person's edit appears within 20 seconds instead of at once, and a viewer whose access was revoked keeps the page until the next poll fails.

**Options.**

- **Polling only (recommended).** Delete the stream and poll every 20 seconds. A roster changes a few times a week; the stream costs long-lived functions and most of the app's special cases to save 20 seconds.
- **Keep push, on a managed stream.** Move it off hand-built SSE to a hosted realtime service. Same behaviour, less code here, a new vendor.
- **Leave it.** Works today.

**Know first.** The value of `LIVE_SYNC_ENABLED` in production, the function duration limit on the Vercel plan, and what the events route costs in a month of function time.

**Unlocks.** With polling only, Redis keeps two jobs: rate-limit counters (entry 7) and Better Auth's session cache. `README.md`'s live-sync section goes.

## 7. Rate limiting without Redis

**Today.** `~/lib/space-rate-limit.ts` counts in Redis, and returns "allowed" for every request when `REDIS_URL` is unset. Three callers rely on it: the private-space password check (10 attempts per space and IP per minute), invitation sends (50 per user per hour, 200 per team per day, in `~/lib/invitations.ts`) and live-sync admission (`~/lib/team-event-admission.ts`). `REDIS_URL` is optional in `~/lib/env.ts`, so a deployment without it starts normally and has no limit on password guesses, silently.

**Why it is open.** Each fix changes how a deployment without Redis behaves.

**Options.**

- **Count in Postgres when there is no Redis (recommended).** Better Auth already keeps its own limits in the `RateLimit` table when it has no Redis (`packages/auth/src/server.ts`). The limit holds everywhere and no variable becomes required.
- **Fail closed in production.** Refuse to start, or refuse the request, without `REDIS_URL`. Simple, and it makes Redis required for every deployment, forks included.
- **Keep allowing, and log once at start that limits are off.** Nothing changes for users; the gap becomes visible.

**Know first.** Whether `REDIS_URL` is set in the Production and Preview environments in Vercel. If it is, nothing is exposed today and this is about forks and misconfiguration.

**Unlocks.** With the first option and polling in entry 6, Redis is left with Better Auth's session cache and can be removed.

## 8. Hand-written primitives

Four pieces of code do what a library does. Each is a separate choice.

**The access token** (`~/lib/workspace-access.ts`). An HMAC-signed payload with its own version field, expiry and timing-safe compare, about 80 lines. `jose` covers it; it is in the tree through Better Auth, and using it means declaring it in `apps/web/package.json`. Changing the format invalidates every guest's password grant once. _Recommended: leave it, unless entry 4 is being done, which signs those guests out anyway._

**The `Cookie` header parser** (`parseAccessCookies` in the same file). Reads access cookies out of the raw header during sign-in, about 30 lines. The `cookie` package does this; it is in the tree through other packages and would need declaring the same way. No user effect. _Recommended: replace it the next time this file changes._

**The CSV parser** (`~/components/import-members-dialog/parse-csv.ts`). It splits the file on line breaks before it looks at quotes, so a quoted cell that contains a line break becomes two rows. A CSV library fixes that and is a new dependency. _Recommended: add one; this is the only one of the four with a bug a user can hit._

**Space password hashing** (`~/lib/crypto.ts`). Uses `bcryptjs`, while account passwords go through Better Auth's own hasher. Switching leaves existing space passwords unverifiable: either every owner sets the password again, or the app verifies both formats, which is a compatibility path. _Recommended: keep `bcryptjs`._

## 9. Account name length

**Today.** Sign-up and settings accept a name of 1 to 100 characters (`accountNameSchema` in `~/lib/form-schemas.ts`). The auth policy shared across the fleet, `packages/auth/src/policy.ts`, says 3 to 32 (`NAME_LENGTH`), and this app does not use that rule for names.

**Why it is open.** Adopting 3 to 32 rejects two-letter names and stops anyone whose stored name falls outside the range from saving their profile until they change it.

**Options.**

- **Keep 1 to 100 (recommended).** "Li" and "Bo" are names. The difference from the shared policy stays, on purpose.
- **Adopt 3 to 32.** One rule everywhere; some real names are refused.
- **Adopt only the maximum, 1 to 32.** Shorter display names in the roster, no minimum.

**Know first.** Who a stricter rule would affect, read-only:

```sql
SELECT count(*) FILTER (WHERE char_length(trim(name)) < 3) AS shorter_than_3,
       count(*) FILTER (WHERE char_length(name) > 32) AS longer_than_32,
       count(*) AS total
FROM "User";
```

## 10. Error boundaries: `reset` or `retry`

**Today.** Next passes an error boundary two functions. `retry` fetches the segment again and re-renders it; `reset` clears the error and re-renders without fetching. `~/app/[teamId]/error.tsx` calls `retry`. `~/app/error.tsx` and `~/app/global-error.tsx` call `reset` from their "Try again" button, and the shared hook's props type in `packages/ui/src/hooks/use-error-report.ts` names only `retry`.

**Why it is open.** It changes what the button does for a user after a failed load.

**Options.**

- **Use `retry` in all three (recommended).** After a server error "Try again" asks the server again, which is what the label says. Next's own documentation recommends it.
- **Keep `reset` in the two root boundaries.** The button re-renders with the data that already failed, which usually fails again.

## 11. Request logs and the signed-in user

**Today.** Route handlers log one structured event per request through `withEvlog` (`~/lib/observability.ts`). `packages/observability/src/auth.ts` exports `identifyUser`, which adds the session id and the user's id and email to that event. Nothing calls it, so no request log says who made the request.

**Why it is open.** Calling it changes what production logs contain: an email address and a user id on every signed-in request.

**Options.**

- **Call it with the user id only (recommended).** Add the id where `getSession` resolves in `~/lib/auth-server.ts`. A failed request can be tied to an account without putting email addresses in the logs.
- **Call it as exported.** Id, email and session id on every event. Easiest to search; the log store then holds personal data.
- **Leave logs anonymous.** Nothing to retain or redact. A user's report cannot be matched to a request.

**Know first.** Where the logs are kept and for how long.

## 12. Two e2e specs that fail now and then

**Today.** CI retries a failed e2e test twice (`playwright.config.ts`). Two tests still fail whole runs from time to time and pass on a rerun with no change:

- `tests/e2e/auth/login.spec.ts`, "navigates to signup page", fails inside `instant()` from `@next/playwright` with `Storage.getCookies: Failed to find browser context`.
- `tests/e2e/auth-email/invitation.spec.ts`: the guest's click on "Create account" sometimes never navigates.

**Why it is open.** Every fix trades coverage for a stable gate, or costs time to find the cause.

**Options.**

- **Take `instant()` out of the first test, and find the cause of the second (recommended).** "shows the login shell on initial load" in the same file keeps the instant-navigation check. The second looks like a click that lands before the form is interactive, which is a real bug if a person can hit it too.
- **Quarantine both** until `@next/playwright` is upgraded. A green gate, and no test of the invitation path from the email.
- **Leave them and rerun.** Costs a rerun each time, and teaches everyone to distrust a red e2e run.
