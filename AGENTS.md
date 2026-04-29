# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## What is Collabtime

A real-time team timezone visualizer SaaS. Distributed teams create spaces, add members with timezones/working hours, and visualize overlap for scheduling. Changes sync live via Upstash Realtime WebSockets.

## Commands

```bash
pnpm dev                  # Start all apps + packages in dev mode (Turbopack, via portless)
pnpm build                # Build everything
pnpm lint                 # Lint with oxlint
pnpm format               # Format with oxfmt
pnpm format:check         # Check formatting
pnpm typecheck            # TypeScript type checking
pnpm db:generate          # Generate Prisma client
pnpm db:push              # Push schema changes to database
pnpm db:seed              # Seed database

# Run a single workspace command
pnpm --filter web dev     # Dev only the web app
pnpm --filter @repo/ui build  # Build only the UI package
```

### Testing

```bash
pnpm test                         # vitest unit tests
pnpm test:e2e                     # playwright (chromium, firefox, webkit)
pnpm test:e2e:ui                  # playwright with interactive UI
```

## Architecture

pnpm monorepo with Turborepo orchestration. Node >=24, pnpm 10.32.1.

### Apps

- **`apps/web`** — Next.js 16 App Router with React Compiler enabled (`http://collabtime.web.localhost:1355`). Uses `@/*` path alias mapping to `src/*`.

### Packages

- **`@repo/ui`** — Shared component library (Tailwind + CVA). Built with tsdown. Includes TanStack Form field components (`Field`, `FieldGroup`, `FieldLabel`, `FieldError`).
- **`@repo/config-vitest`** — Shared Vitest config. Exports `react.ts` and `node.ts` configs.
- **`@repo/auth`** — Better Auth config with Stripe plugin. Exports `auth-server.ts` (server-only) and `auth-client.ts` (`"use client"`). Uses Prisma adapter.
- **`@repo/db`** — Prisma 7 ORM with PostgreSQL. Schema at `packages/db/prisma/schema.prisma`. Uses `@prisma/adapter-pg` for serverless connection pooling. Generated client output to `packages/db/src/generated`.
- **`@repo/tailwind-config`** — Shared Tailwind CSS v4 config with OKLch color tokens and dark mode.
- **`@repo/typescript-config`** — Base, Next.js, and library TypeScript configs. Strict mode, ESNext target, Bundler module resolution.

### Key patterns

- **Lazy initialization via Proxy**: Auth client, Realtime, and Prisma instances use a Proxy pattern to defer initialization until first access. This avoids build-time errors when env vars are unavailable.
- **Server/client boundary**: `auth-server.ts` imports `"server-only"`, `auth-client.ts` uses `"use client"`. Never cross these boundaries.
- **Env validation**: `apps/web/src/lib/env.ts` validates all env vars with Zod at startup. Use `getEnv(key)` for type-safe access.
- **Realtime events**: Schema-validated with Zod in `@repo/auth`. Event types cover member CRUD, group CRUD, reordering, and name updates on team channels.

### API routes

All under `apps/web/src/app/api/`:

- `auth/[...all]` — Better Auth catch-all handler
- `realtime/` — Upstash Realtime sync
- `spaces/` and `spaces/[spaceId]/` — Space CRUD, password verification
- `subscription/checkout/` and `subscription/portal/` — Stripe subscription management

### Data models

User → Session, Account, Subscription, Space. Users have a `subscriptionPlan` (FREE|PRO) and optional `stripeCustomerId`. Spaces link to teams via unique `teamId` and support private access with passwords.

## Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS v4, Radix UI, @tanstack/react-form + Zod 4, TanStack Query, Motion (Framer Motion), Sonner, Lucide
- **Auth**: Better Auth with email/password, Stripe integration
- **Database**: PostgreSQL via Prisma 7 with `@prisma/adapter-pg`
- **Payments**: Stripe (subscriptions, webhooks, customer portal)
- **Realtime**: Upstash Realtime (WebSocket) + Upstash Redis
- **Linting**: oxlint with plugins (perfectionist, unused-imports, react-hooks, unicorn, typescript, import)
- **Formatting**: oxfmt, enforced via husky + lint-staged on commit
- **Bundling**: tsdown for library packages, Turbopack for Next.js dev

## Linting rules to know

- `no-console` is **error** globally (off in `apps/web/src/**` and `**/seed.ts`)
- `@typescript-eslint/no-explicit-any` is **error** (off in test files)
- `@typescript-eslint/array-type` enforces `Array<T>` syntax (generic), not `T[]`
- `perfectionist/sort-objects` and `sort-jsx-props` are **error** globally but **off** in `apps/web/src/**` and `packages/ui/src/**`
- `perfectionist/sort-interfaces` and `sort-object-types` are always **error**
- `curly` is enforced (always use braces)
- `unused-imports/no-unused-imports` is **error**
- `@nocommit` in comments triggers `no-warning-comments` error

## Environment variables

Required: `DATABASE_URL`, `BETTER_AUTH_SECRET` (≥32 chars), `BETTER_AUTH_URL`, `STRIPE_SECRET_KEY` (sk*\*), `STRIPE_WEBHOOK_SECRET` (whsec*\_), `STRIPE_PRO_PRICE_ID` (price\_\_), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

Optional: `WEB_APP_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SPACE_ACCESS_SECRET`, `NODE_ENV`

## Portless (Dev URLs)

The dev server runs behind portless, which gives the app a stable HTTPS URL on `.localhost` instead of guessing port numbers. Cookies, OAuth redirects, and CORS allowlists stay valid across project switches.

### Setup (one-time per machine)

```bash
npm install -g portless                # global install (or upgrade)
sudo portless proxy start --https      # start the daemon on :443
```

The proxy auto-restarts on subsequent invocations once trusted.

### URLs

| Service | URL                                | Started by |
| ------- | ---------------------------------- | ---------- |
| `web`   | `https://collabtime.web.localhost` | `pnpm dev` |

### Worktrees

Branch name auto-prefixes the subdomain — no port collisions between concurrent worktrees, each gets its own auto-assigned backing port:

```
main worktree:        https://collabtime.web.localhost
branch fix-styles:    https://fix-styles.collabtime.web.localhost
```

## Dev Tools (Development Only)

- **React Scan** — highlights unnecessary re-renders, loaded via `<script>` in root layout when `NODE_ENV=development`
- **React Grab** — inspect React component tree, loaded via `<script>` in root layout when `NODE_ENV=development`
- Neither tool runs in production builds

## Tooling

- **Linter**: oxlint (NOT ESLint). Config in `.oxlintrc.json`. Uses `oxlint-config-awesomeness`.
- **Formatter**: oxfmt (NOT Prettier). Config in `.oxfmtrc.json`. Sorts Tailwind classes and imports.
- **Pre-commit**: Husky + lint-staged runs `oxlint` (on `.ts,.tsx,.js,.jsx` files) and `oxfmt` (on `.ts,.tsx,.js,.jsx,.json,.md` files).
- **Testing**: Vitest for unit tests, Playwright for e2e (chromium, firefox, webkit). `@repo/config-vitest` exports `react.ts` and `node.ts` configs.
- **Bundler**: tsdown for library packages, Turbopack for Next.js dev.

## Forms

- **@tanstack/react-form** (NOT react-hook-form)
- Validation: `onBlur` + `onChange` validators with Zod schemas
- Display errors with `field.state.meta.isTouched && !field.state.meta.isValid`
- Field components from `@repo/ui`: `Field`, `FieldGroup`, `FieldLabel`, `FieldError`
- NEVER use `field.handleChange` inside `useEffect` or `useCallback` with `field` in deps — use `field.form.setFieldValue(field.name, value)` with stable refs

## CI (GitHub Actions)

- `test.yml` — `pnpm test`
- `lint.yml` — `pnpm oxlint --format=github .`
- `format.yml` — `pnpm run format:check`
- `fallow.yml` — `pnpm fallow:dead` (cross-file dead code, unused exports, circular deps)
- All use `permissions: { contents: read }` and `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`

## Prisma

`prisma.config.ts` uses `process.env.DATABASE_URL ?? ""` (not `env("DATABASE_URL")`) so `prisma generate` works in CI without database credentials.
