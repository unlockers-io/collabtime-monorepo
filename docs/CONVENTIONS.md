# Conventions

This document records the defaults used across the collabtime monorepo. New code should follow them; existing code that diverges is a candidate for a slop-cleanup pass.

## API responses

- All HTTP endpoints live as Next.js route handlers under `apps/web/src/app/api/`.
- Success with a body: a named-key payload (`{ spaces }`, `{ space }`). The key names the resource so adding siblings later doesn't break clients.
- Success with no body: `204 No Content`.
- Errors: `{ error: "message" }` with the proper status code (`401`, `403`, `404`, `422`, `500`). Validate input with Zod at the handler boundary and let the handler render the error response; never bury error-shaped JSON in helpers.

## Errors

- Never swallow into `null`, `{}`, or empty arrays. A returned-null on the success path is fine when it means "no row"; a returned-null in a catch block is silent failure.
- In Next.js RSC helpers: do not wrap in try/catch unless you are handling a _specific_ expected error. Let unknown failures propagate; Next.js renders `error.tsx` and captures the stack with full context.
- `console.error` is not a logger. Log through `@repo/observability`; in the web app, import `log` from `@/lib/observability`.

## File organization

- One `lib/` folder per app and per package. No `services/`, no `utils/`, no `helpers/`.
- Filename equals subject: `users.ts`, not `user.service.ts` or `userHelpers.ts`.
- Tests sit next to the file they cover: `users.ts` + `users.test.ts`.

## Service shape

- Prefer module-level exported async functions.
- Reach for a class only when there is real per-instance state (rare in our codebase: Prisma's singleton and Better Auth's instance are the only current examples, both encapsulated in their own packages).

## Comments

- WHY-only. The code already says WHAT.
- No historical references: don't write "added for #93", "removed X", "previously did Y". Those belong in the PR description and git log.
- One short line is the norm. Multi-line comment blocks need real justification (a non-obvious invariant, a hidden constraint, a subtle workaround).

## Test mocks

- No `as unknown as X` casts to fake framework types in test files. Use shared typed helpers.
- Mocks should be the minimum needed for the test. If a test only needs two properties, the helper should only expose those.

## Forms

- `@tanstack/react-form`, never `react-hook-form`.
- Validate `onBlur` + `onChange` with Zod schemas.
- Display errors with `field.state.meta.isTouched && !field.state.meta.isValid`.
- Never call `field.handleChange` inside `useEffect` or `useCallback` with `field` in deps; use `field.form.setFieldValue(field.name, value)` with stable refs.

## Tooling

- Linter: oxlint. Not ESLint.
- Formatter: oxfmt. Not Prettier.
- Bundler (library packages: `@repo/db`, `@repo/transactional`): tsdown.
- Bundler (web): Next.js' Turbopack in dev, native in build.

## Routes

- Better Auth is mounted at `/api/auth/[...all]`; everything else sits under `/api/*` (spaces, subscription).
- Path alias: `@/*` maps to `src/*` in every app and package.
