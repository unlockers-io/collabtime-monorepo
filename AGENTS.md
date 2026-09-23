# AGENTS.md

Guidance for AI coding agents working in this repo. `CLAUDE.md` is a symlink to this file.

Project conventions and defaults live in [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).

Collabtime is a team timezone visualizer. Distributed teams create spaces, add members with timezones and working hours, and visualize overlap for scheduling. Single `web` app, pnpm monorepo, Better Auth, Prisma/Postgres, Redis. There is no billing: no Stripe, no plans, no paid tier.

## Stack

- **Framework**: Next.js 16 App Router (Turbopack, React Compiler enabled)
- **Language**: TypeScript strict, ESNext, Bundler module resolution
- **UI**: React 19, Tailwind CSS v4, Base UI (`@base-ui/react`), Motion, Sonner, Lucide
- **Fonts**: Inter as `--font-sans` (body / UI), Manrope as `--font-display` (headings), Geist Mono as `--font-mono` (clock and hour numerals). All three loaded via `next/font` in `apps/web/src/app/layout.tsx`, registered in the `@theme inline` block of `packages/ui/src/styles/globals.css`
- **Forms**: `@tanstack/react-form` + Zod 4 (NOT react-hook-form)
- **Data**: TanStack Query with SSE team sync, five-minute safety polling, and 20s fallback polling
- **Auth**: Better Auth (email/password)
- **DB**: Prisma 7 + PostgreSQL via `@prisma/adapter-pg`
- **Cache / session**: Redis via `ioredis` (Railway in prod, supports `redis://` or `rediss://`)
- **Email**: Resend (optional)
- **Monorepo**: Turborepo + pnpm workspaces, Node >=24, `packageManager: pnpm@11.13.1`
- **Lint / format**: oxlint + oxfmt (NOT ESLint/Prettier), `oxlint-config-awesomeness`
- **Tests**: Vitest (unit), Playwright (e2e: chromium, firefox, webkit)
- **Bundler**: tsdown for library packages, Turbopack for Next.js dev
- **Dead-code / circular deps**: `fallow`

## Layout

```
apps/web/                       # Next.js 16 App Router app (only app)
packages/auth/                  # Better Auth server + client
packages/db/                    # Prisma schema + generated client
packages/ui/                    # Shared component library (Tailwind + CVA)
packages/observability/         # Structured logging (`@repo/observability`)
packages/transactional/         # Email templates (Resend)
packages/config-typescript/     # Base / Next / library tsconfigs
packages/config-vitest/         # Shared Vitest configs (react.ts, node.ts)
packages/portless-env/          # applyPortlessUrls: dev URL env vars from `portless get`
tests/                          # Playwright e2e specs
docker-compose.yml              # Postgres :5433, Redis :6379
playwright.config.ts
turbo.json
oxlint.config.ts                # plus .oxfmtrc.json
```

## Dev workflow

```bash
pnpm dev                  # turbo run dev --concurrency 16 (Turbopack via portless)
pnpm build                # turbo run build
pnpm typecheck            # turbo run typecheck
pnpm lint                 # oxlint .
pnpm format               # oxfmt
pnpm format:check         # oxfmt --check
pnpm test                 # turbo run test (vitest)
pnpm test:e2e             # playwright test
pnpm test:e2e:ui          # playwright test --ui
pnpm db:generate          # Prisma client
pnpm db:push              # Push schema to DB
pnpm db:seed              # Seed DB
pnpm clean                # turbo clean + rm -rf node_modules

# Single-workspace
pnpm --filter @repo/web dev
pnpm --filter @repo/ui build

# Dead-code / health
pnpm fallow:dead          # cross-file dead code, unused exports, circular deps
pnpm fallow:dupes
pnpm fallow:health --score
pnpm fallow:audit         # --base main
```

## Portless dev URLs

Dev server runs behind portless: HTTPS on `.localhost:443`, no port juggling. Cookies, OAuth redirects, and CORS allowlists stay valid across project switches.

One-time per machine:

```bash
npm install -g portless
sudo portless proxy start --https
```

| Service | URL                                |
| ------- | ---------------------------------- |
| `web`   | `https://collabtime.web.localhost` |

Branch worktrees auto-prefix the subdomain: `https://fix-styles.collabtime.web.localhost`. Each gets its own auto-assigned backing port, so there are no collisions.

Docker host ports: Postgres `5433`, Redis `6379`. Only one project's stack runs at a time on these ports unless explicitly remapped.

App configs resolve those URLs through `@repo/portless-env` rather than hardcoding them. `applyPortlessUrls({ ENV_VAR: ["<subdomain>"] })` runs at the top of each `next.config.ts` / `tsdown.config.ts` and shells out to `portless get` for every name, filling the env var only when it is unset or still holds the canonical `*.localhost` default. It is a no-op unless `PORTLESS_URL` is set, so CI and production keep their real values. Import it by bare specifier (`@repo/portless-env`): a relative path resolves from the process cwd and breaks `next start apps/web` from the repo root.

## Environment variables

Required: `DATABASE_URL`, `BETTER_AUTH_SECRET` (>=32 chars). Those are the only two the schema rejects when absent.

Optional: `REDIS_URL` (`redis://` or `rediss://`), `WEB_APP_URL`, `AUTH_ALLOWED_HOSTS`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (bare email or `Display Name <email>`), `SPACE_ACCESS_SECRET` (>=32 chars), `NODE_ENV`.

`REDIS_URL` also accepts an empty string, because unset GitHub secrets expand to `""` in CI.

Validated in `apps/web/src/lib/env.ts` with Zod at startup; access via `getEnv(key)`.

## Conventions & gotchas

- **Server actions authorize first**: every exported action opens with a guard from `lib/team-auth.ts` (`authenticate`, `authorizeTeamAdmin`, `authorizeTeamMember`) and returns its failure unchanged. `mutateTeam` takes the `TeamAccess` a guard returns, so no team write runs without one. Look up invitations and join requests only after authorizing, and only within the authorized team.
- **Lazy init via Proxy**: Auth client, Redis, and Prisma instances defer initialization until first access. Avoids build-time errors when env vars are absent.
- **Server/client boundary**: `@repo/auth/server` holds the Better Auth server instance; `@repo/auth/client` re-exports the React auth client. Never cross.
- **Live sync**: `use-team-live-sync.ts` shares an SSE connection per team per tab; Redis Pub/Sub notifications invalidate the existing `getPublicTeam` query. `use-team-query.ts` polls every five minutes while live and every 20s otherwise. Mutations use `useTeamMutation` for optimistic updates. `LIVE_SYNC_ENABLED=false` disables streams; Turbo forwards this optional server flag. Stream callbacks use captured access tokens, never request-scoped cookies or sessions.
- **Forms**: validate `onBlur` + `onChange` with Zod. Show errors via `field.state.meta.isTouched && !field.state.meta.isValid`. Field primitives (`Field`, `FieldGroup`, `FieldLabel`, `FieldError`) live in `@repo/ui`.
- **TanStack `field` in effect deps is banned**: never put `field.handleChange` inside `useEffect`/`useCallback` with `field` in deps. Use `field.form.setFieldValue(field.name, value)` with a stable ref.
- **Prisma config**: `prisma.config.ts` uses `process.env.DATABASE_URL ?? ""` (not `env("DATABASE_URL")`) so `prisma generate` works in CI without DB creds.
- **Turbo ordering**: root `turbo.json` `build.dependsOn` includes `db:generate` so the Prisma client exists before any app/package builds.
- **Path alias**: `apps/web` uses `@/*` -> `src/*`.
- **`/` serves two pages**: `app/page.tsx` reads the session and renders `components/landing/` when logged out, `app/home-client.tsx` (the dashboard) when logged in. Both `Suspense` fallbacks are intentionally `null`: either page can follow the outer one, so no skeleton fits, and the dashboard header streams ahead of the inner one.
- **Landing product demo**: `components/landing/product-preview.tsx` renders the real `TimezoneVisualizer` against the static team in `demo-team.ts`, lazily via `next/dynamic` with `ssr: false`. `useTimezoneData` is pure, so the demo needs no fetching. Keep `demo-team.ts` hours as they are unless you re-check the overlap: they are picked so four of five members share a real window.
- **Design guidelines**: landing work follows the `design` skill's rule files. Two deliberate deviations, both because the repo's own lint wins: no `role="list"` on `<ul>` (oxlint `no-redundant-roles` errors on it), and the shared button keeps its ring-based `focus-visible` treatment rather than `outline-*`.

## Linting & formatting

- **oxlint** extending `oxlint-config-awesomeness` (450 rules across 10 plugins) in `oxlint.config.ts`. Narrow per-file overrides live there, each with a WHY comment.
- Notable enforced rules: `no-console` (error; `off` for E2E teardown scripts via repo override, plus seed/migration/CLI scripts and stories via the shared preset; app and package code logs via `@repo/observability`), `typescript/no-explicit-any`, `perfectionist/sort-objects` + `sort-jsx-props`, `unicorn/consistent-function-scoping`, `jsx-a11y/*` (labels, roles, no-autofocus), `require-unicode-regexp` (`/v` regexes, off under `tests/`), `prefer-named-capture-group`, `curly`, `max-lines` (400), `unused-imports/no-unused-imports`.
- **oxfmt** (config in `.oxfmtrc.json`) formats TS/JS/JSON/MD and sorts Tailwind classes + imports.
- Pre-commit (husky + lint-staged): `oxlint` on JS/TS files, `oxfmt` on JS/TS/JSON/MD.

## Dev tools (development only)

- **React Scan**: flags unnecessary re-renders, loaded via `<script>` in root layout when `NODE_ENV=development`
- **React Grab**: inspect component tree, loaded the same way
- Neither runs in production builds

## API routes

All under `apps/web/src/app/api/`:

- `auth/[...all]`: Better Auth catch-all
- `spaces/` and `spaces/[spaceId]/`: Space CRUD, password verification
- `teams/`: the caller's teams, plus `teams/[teamId]/membership` for archive toggling and `teams/[teamId]/events` for authorized SSE notifications
- `invitations/`: the caller's pending, unexpired invitations (`expiresAt: null` preserves legacy invitations). Admin invitation management uses server actions; expired pending invitations remain visible there for Resend/Revoke.

## Data model

`User` -> `Session`, `Account`, `Space` (owned), `Membership`, `JoinRequest`, `Invitation` (sent). Plus `Verification` for auth tokens and `RateLimit`.

Enums: `MemberRole` (ADMIN | MEMBER), `JoinRequestStatus`, `InvitationStatus` (PENDING | ACCEPTED | DECLINED | REVOKED). Invitations expire after 14 days, remain email-bound, and use `/{teamId}?invite=<cuid>` links as contextual hints. Invite and resend share limits of 50/user/hour and 200/team/day.

Spaces link to teams via a unique `teamId` and support private access through `isPrivate` + `accessPassword`. A public space is readable by anyone with the link, with no session at all: see the guest path in `apps/web/src/app/[teamId]/page.tsx`.

## CI (GitHub Actions)

- `test.yml`: `pnpm test`
- `lint.yml`: `pnpm oxlint --format=github .`
- `e2e.yml`: Playwright
- `typecheck.yml`: `pnpm typecheck`
- `secret-scan.yml`: gitleaks
- `react-doctor.yml`: React Doctor scan
- Workflows use `permissions: { contents: read }`, except `react-doctor.yml`, which also needs `issues`, `pull-requests` and `statuses` write to post its comment and commit status

- All workflows pin `actions/checkout` by SHA to v7.0.1.

## References

- Conventions: [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md)
- Better Auth docs: <https://better-auth.com>
- Prisma 7: <https://www.prisma.io/docs>
- oxlint: <https://oxc.rs>
- portless: <https://portless.dev>

## Design-system linting

Run `pnpm lint` after changes and fix every error. `oxlint.config.ts` registers `@shadcn/lint` and enforces all six rules as errors: component contracts, known Tailwind classes, static component class names, semantic colors, theme or scale values, and class-based styling. Use CSS custom properties for runtime geometry and named theme tokens for custom values. Use component variants for appearance and layout classes at call sites. All six rules also apply inside primitive directories. Shared styles belong to component variants or the owning stylesheet. Keep theme discovery local to each app. Exact class-merging fixture allowances apply only to the named test files.

## Upstream UI components

Keep registry primitives in `packages/ui/src/components` aligned with their configured shadcn Base UI style. Product adapters belong in `packages/ui/src/compositions`. Import variant factories beside the component, use local input IDs, normalize arbitrary validators through `FormFieldError`, and preserve semantic headings at call sites. Keep product branding in the theme, load `shadcn/tailwind.css`, and run `pnpm check:shadcn` with lint, typechecks, tests and the build. See `packages/ui/SHADCN.md` before updating the reviewed source lock.
