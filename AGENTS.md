# AGENTS.md

Guidance for AI coding agents working in this repo. `CLAUDE.md` is a symlink to this file.

Project conventions and defaults live in [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).

Collabtime is a team timezone visualizer SaaS. Distributed teams create spaces, add members with timezones and working hours, and visualize overlap for scheduling. Single `web` app, pnpm monorepo, Better Auth + Stripe, Prisma/Postgres, Redis.

## Stack

- **Framework**: Next.js 16 App Router (Turbopack, React Compiler enabled)
- **Language**: TypeScript strict, ESNext, Bundler module resolution
- **UI**: React 19, Tailwind CSS v4, Radix UI, Motion, Sonner, Lucide
- **Forms**: `@tanstack/react-form` + Zod 4 (NOT react-hook-form)
- **Data**: TanStack Query with 20s polling for team sync
- **Auth**: Better Auth (email/password) + Stripe plugin
- **DB**: Prisma 7 + PostgreSQL via `@prisma/adapter-pg`
- **Cache / session**: Redis via `ioredis` (Railway in prod, supports `redis://` or `rediss://`)
- **Payments**: Stripe subscriptions, webhooks, customer portal
- **Email**: Resend (optional)
- **Monorepo**: Turborepo + pnpm workspaces, Node >=24, `packageManager: pnpm@11.1.3`
- **Lint / format**: oxlint + oxfmt (NOT ESLint/Prettier), `oxlint-config-awesomeness`
- **Tests**: Vitest (unit), Playwright (e2e — chromium, firefox, webkit)
- **Bundler**: tsdown for library packages, Turbopack for Next.js dev
- **Dead-code / circular deps**: `fallow`

## Layout

```
apps/web/                       # Next.js 16 App Router app (only app)
packages/auth/                  # Better Auth server + client, Stripe plugin
packages/db/                    # Prisma schema + generated client
packages/ui/                    # Shared component library (Tailwind + CVA)
packages/transactional/         # Email templates (Resend)
packages/config-typescript/     # Base / Next / library tsconfigs
packages/config-vitest/         # Shared Vitest configs (react.ts, node.ts)
tests/                          # Playwright e2e specs
docker-compose.yml              # Postgres :5433, Redis :6379, Upstash REST shim :8079
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
pnpm --filter web dev
pnpm --filter @repo/ui build

# Dead-code / health
pnpm fallow:dead          # cross-file dead code, unused exports, circular deps
pnpm fallow:dupes
pnpm fallow:health --score
pnpm fallow:audit         # --base main
```

## Portless dev URLs

Dev server runs behind portless — HTTPS on `.localhost:443`, no port juggling. Cookies, OAuth redirects, and CORS allowlists stay valid across project switches.

One-time per machine:

```bash
npm install -g portless
sudo portless proxy start --https
```

| Service | URL                                |
| ------- | ---------------------------------- |
| `web`   | `https://collabtime.web.localhost` |

Branch worktrees auto-prefix the subdomain: `https://fix-styles.collabtime.web.localhost`. Each gets its own auto-assigned backing port — no collisions.

Docker host ports: Postgres `5433`, Redis `6379`, Upstash REST shim `8079`. Only one project's stack runs at a time on these ports unless explicitly remapped.

## Environment variables

Required: `DATABASE_URL`, `BETTER_AUTH_SECRET` (>=32 chars), `STRIPE_SECRET_KEY` (`sk_*`), `STRIPE_WEBHOOK_SECRET` (`whsec_*`), `STRIPE_PRO_PRICE_ID` (`price_*`), `REDIS_URL` (`redis://` or `rediss://`).

Optional: `WEB_APP_URL`, `AUTH_ALLOWED_HOSTS`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SPACE_ACCESS_SECRET`, `NODE_ENV`.

Validated in `apps/web/src/lib/env.ts` with Zod at startup; access via `getEnv(key)`.

## Conventions & gotchas

- **Lazy init via Proxy**: Auth client, Redis, and Prisma instances defer initialization until first access. Avoids build-time errors when env vars are absent.
- **Server/client boundary**: `@repo/auth/auth-server` imports `"server-only"`; `@repo/auth/auth-client` uses `"use client"`. Never cross.
- **Polling sync**: Team data fetched every 20s via `use-team-query.ts`. Mutations call `useUpdateTeamCache` for immediate optimistic update on the acting client.
- **Forms**: validate `onBlur` + `onChange` with Zod. Show errors via `field.state.meta.isTouched && !field.state.meta.isValid`. Field primitives (`Field`, `FieldGroup`, `FieldLabel`, `FieldError`) live in `@repo/ui`.
- **TanStack `field` in effect deps is banned** — never put `field.handleChange` inside `useEffect`/`useCallback` with `field` in deps. Use `field.form.setFieldValue(field.name, value)` with a stable ref.
- **Prisma config**: `prisma.config.ts` uses `process.env.DATABASE_URL ?? ""` (not `env("DATABASE_URL")`) so `prisma generate` works in CI without DB creds.
- **Turbo ordering**: root `turbo.json` `build.dependsOn` includes `db:generate` so the Prisma client exists before any app/package builds.
- **Path alias**: `apps/web` uses `@/*` -> `src/*`.

## Linting & formatting

- **oxlint** extending `oxlint-config-awesomeness` (450 rules across 10 plugins) in `oxlint.config.ts`. Narrow per-file overrides live there, each with a WHY comment.
- Notable enforced rules: `no-console` (error; `off` for E2E teardown scripts via repo override, plus seed/migration/CLI scripts and stories via the shared preset — app and package code logs via `@repo/observability`), `typescript/no-explicit-any`, `perfectionist/sort-objects` + `sort-jsx-props`, `unicorn/consistent-function-scoping`, `jsx-a11y/*` (labels, roles, no-autofocus), `require-unicode-regexp` (`/v` regexes — off under `tests/`), `prefer-named-capture-group`, `curly`, `max-lines` (400), `unused-imports/no-unused-imports`.
- **oxfmt** (config in `.oxfmtrc.json`) formats TS/JS/JSON/MD and sorts Tailwind classes + imports.
- Pre-commit (husky + lint-staged): `oxlint` on JS/TS files, `oxfmt` on JS/TS/JSON/MD.

## Dev tools (development only)

- **React Scan** — flags unnecessary re-renders, loaded via `<script>` in root layout when `NODE_ENV=development`
- **React Grab** — inspect component tree, loaded the same way
- Neither runs in production builds

## API routes

All under `apps/web/src/app/api/`:

- `auth/[...all]` — Better Auth catch-all
- `spaces/` and `spaces/[spaceId]/` — Space CRUD, password verification
- `subscription/checkout/` and `subscription/portal/` — Stripe checkout + customer portal

## Data model

User -> Session, Account, Subscription, Space. Users have `subscriptionPlan` (FREE|PRO) and optional `stripeCustomerId`. Spaces link to teams via unique `teamId` and support private access with passwords.

## CI (GitHub Actions)

- `test.yml` — `pnpm test`
- `lint.yml` — `pnpm oxlint --format=github .`
- `format.yml` — `pnpm run format:check`
- `fallow.yml` — `pnpm fallow:dead`
- `e2e.yml` — Playwright
- All workflows use `permissions: { contents: read }`

## References

- Conventions: [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md)
- Sibling repos (control plane): `~/dev/orchestrator` (standards.md + verifiers)
- Template / source of truth for `saas` profile: `~/dev/acme-monorepo`
- Better Auth docs: <https://better-auth.com>
- Prisma 7: <https://www.prisma.io/docs>
- oxlint: <https://oxc.rs>
- portless: <https://portless.dev>
