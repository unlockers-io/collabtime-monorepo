# PostgreSQL team-store cutover

Team contents, roster claims, membership grants and revocations, invitation acceptance and join approval now use the same PostgreSQL transaction and team advisory lock. Redis carries Pub/Sub and auth/cache data. No schema columns or tables are deleted.

Existing PostgreSQL mirrors are not assumed complete. The new nullable `Space.teamCreatedAt` and `teamExpiresAt` fields identify initialized contents. Uninitialized or expired contents are unreadable. New contents retain the original 60-day lifetime; reads and edits extend that to two years. Import preserves the original JSON creation string and exact Redis expiry deadline. It drops obsolete membership revision tokens, fills missing member order and treats dangling groups as ungrouped, matching the old reader.

Before deployment:

1. Back up PostgreSQL and Redis, then stop every application process, job and tool that can read or write teams. Old readers extend Redis TTLs. Keep both app versions stopped throughout import and verification.
2. Apply the additive schema with `pnpm db:push`. Do not run the new app against uninitialized mirrors.
3. Run `pnpm --filter @repo/web exec tsx scripts/cutover-team-store.ts --writers-stopped --apply` with the intended database and Redis environment. The command validates all Redis teams and claimed memberships before writing. It refuses malformed records, missing spaces, claims without membership and overwriting initialized PostgreSQL contents that differ. Investigate any failure against the backups; do not start the app with partial import.
4. Run `pnpm --filter @repo/web exec tsx scripts/cutover-team-store.ts --writers-stopped`. Verification compares creation strings, names, password hashes, groups, all member fields and exact retention deadlines, without extending expiry. Require zero problems and reconcile the scanned team count with the Redis inventory. Expired Redis keys and orphan SQL mirrors are deliberately not resurrected.
5. Start only the new app and verify authenticated, guest and private-space access plus live membership changes. Keep backups and old Redis team keys until the cutover is accepted. Do not run `--apply` again after new writes begin.

Rolling back after new PostgreSQL writes requires an explicit reverse data transfer while all writers are stopped. Starting the old app would read stale Redis data. This PR does not deploy or run a production cutover.
