# Collab Time

Real-time team timezone visualizer. Launching soon.

## Stack

- **Framework:** Next.js 16
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4, Radix UI, shadcn/ui patterns
- **Database:** Drizzle ORM, PostgreSQL
- **Auth:** Better Auth + Stripe
- **Cache:** Redis via ioredis (Railway-hosted)
- **Monorepo:** Turborepo, pnpm workspaces
- **Linting:** oxlint
- **Formatting:** oxfmt
- **Testing:** Vitest (unit), Playwright (e2e)

## Apps

| App   | Description      | Port |
| ----- | ---------------- | ---- |
| `web` | Main application | 3000 |

## Packages

| Package                   | Description                    |
| ------------------------- | ------------------------------ |
| `@repo/ui`                | Shared React component library |
| `@repo/db`                | Drizzle database client        |
| `@repo/auth`              | Authentication module          |
| `@repo/config-typescript` | Shared TypeScript configs      |
| `@repo/config-tailwind`   | Shared Tailwind CSS config     |
| `@repo/config-vitest`     | Shared Vitest test configs     |

## Setup

### Prerequisites

- **Node.js 24** (use `nvm install 24 && nvm use 24`)
- **pnpm 11** (`npm install -g pnpm@11`)
- **Docker** for the local Postgres + Redis stack
- **portless** for stable HTTPS dev URLs. One-time per machine:

  ```bash
  npm install -g portless
  sudo portless proxy start --https   # binds :443, trusts the local cert
  ```

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp apps/web/.env.example apps/web/.env.local
```

The example values already point at the Docker stack below (`DATABASE_URL` on `:5433`, `REDIS_URL` on `:6379`) and the portless URL. Set `BETTER_AUTH_SECRET` to any 32+ char random string (`openssl rand -base64 32`). Create `packages/db/.env` with the same `DATABASE_URL` so drizzle-kit CLI commands run from that package.

### 3. Start the Docker stack

```bash
docker compose up -d
```

Brings up Postgres on `:5433`, Redis on `:6379`, and the Upstash REST shim on `:8079`.

### 4. Initialize the database

```bash
pnpm db:generate    # run drizzle-kit generate
pnpm db:push        # apply the schema to your database
pnpm db:seed        # optional: seed sample data
```

The seed creates a test user: `test@collabtime.dev` / `password123`.

### 5. Run the dev server

```bash
pnpm dev
```

Open <https://collabtime.web.localhost>. Branch worktrees auto-prefix the subdomain (`https://fix-styles.collabtime.web.localhost`), so concurrent worktrees don't collide.

## Scripts

| Command             | Description                   |
| ------------------- | ----------------------------- |
| `pnpm dev`          | Start all apps in development |
| `pnpm build`        | Build all apps and packages   |
| `pnpm test`         | Run unit tests                |
| `pnpm test:e2e`     | Run Playwright e2e tests      |
| `pnpm lint`         | Run oxlint                    |
| `pnpm format`       | Format with oxfmt             |
| `pnpm format:check` | Check formatting              |
| `pnpm typecheck`    | Run TypeScript checks         |
| `pnpm db:generate`  | Run drizzle-kit generate      |
| `pnpm db:push`      | Push schema to database       |
| `pnpm db:seed`      | Seed database                 |
| `pnpm clean`        | Clean all build artifacts     |
