# Collab Time

Real-time team timezone visualizer. Launching soon.

## Stack

- **Framework:** Next.js 16
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4, Radix UI, shadcn/ui patterns
- **Database:** Prisma 7, PostgreSQL
- **Auth:** Better Auth + Stripe
- **Real-time:** Upstash Redis, Upstash Realtime
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
| `@repo/db`                | Prisma database client         |
| `@repo/auth`              | Authentication module          |
| `@repo/config-typescript` | Shared TypeScript configs      |
| `@repo/config-tailwind`   | Shared Tailwind CSS config     |
| `@repo/config-vitest`     | Shared Vitest test configs     |

## Development

```bash
pnpm install
pnpm dev
```

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
| `pnpm db:generate`  | Generate Prisma client        |
| `pnpm db:push`      | Push schema to database       |
| `pnpm db:seed`      | Seed database                 |
| `pnpm clean`        | Clean all build artifacts     |
