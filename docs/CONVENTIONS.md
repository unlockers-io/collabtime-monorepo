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

## Time display

- Times are always 24-hour `HH:MM`. There is no 12-hour mode and no preference for one.
- Format through `formatMinuteOfDay` / `formatMinuteRange` in `apps/web/src/lib/timezones.ts` or `formatHour` in `lib/utils.ts`. Never hand a time to `toLocaleTimeString` or an `Intl.DateTimeFormat` without `hourCycle: "h23"`: the locale default can be 12-hour.

## Forms

- `@tanstack/react-form`, never `react-hook-form`.
- Validate on submit, then on every change: `validationLogic: revalidateLogic()` with `validators: { onDynamic: schema }`. An error appears only after a submit attempt and clears on the keystroke that fixes it. Never validate on blur.
- Put every rule in the one form-level schema, never in field-level `validators`. TanStack runs form-level validators on submit only after field-level ones pass, so a form mixing the two shows partial errors.
- Display errors with `!field.state.meta.isValid`; the validation logic already holds them back until submit. Don't add an `isTouched`, `isBlurred` or `submissionAttempts` check. `bindField` in `apps/web/src/hooks/use-member-form.ts` does this for the member dialogs.
- On a failed submit, move focus to the first invalid field: `onSubmitInvalid` calls `focusFirstInvalidField(formRef.current)` from `@repo/ui/lib/focus-first-invalid-field`, with `ref={formRef}` on the `ClientReadyForm`. It waits a frame, because TanStack calls `onSubmitInvalid` before React renders `aria-invalid` and while inputs may still be disabled.
- Explain any rule people can't guess (password length, allowed characters) with a `FieldDescription` before they hit it, and keep it visible beside the error, with the input described by both. Live hints such as a strength meter derive from the value; they are not validator errors.
- Server-only failures (wrong password, email taken, rate limits) arrive on submit. Return them per field from `onSubmitAsync` as `{ fields }`, or keep them in local state that the form's `listeners: { onChange }` clears on the next change. Keep auth failures generic.
- Keep submit enabled and disable it only while `isSubmitting`. Never disable on `!canSubmit`: a disabled button can't say which field is wrong. The one exception is a form with exactly one editable field, which may also disable submit while its trimmed value is empty or unchanged. Use it only where empty is the obvious error, such as naming a workspace or a group.
- An input that can't be its own TanStack form, such as the invite section nested inside the edit-member form, follows the same rules by hand: remember that a submit was attempted, and after that re-run the same check on every change.
- Never call `field.handleChange` inside `useEffect` or `useCallback` with `field` in deps; use `field.form.setFieldValue(field.name, value)` with stable refs.

## Tooling

- Linter: oxlint. Not ESLint.
- Formatter: oxfmt. Not Prettier.
- Bundler (library packages: `@repo/db`, `@repo/transactional`): tsdown.
- Bundler (web): Next.js' Turbopack in dev, native in build.

## Routes

- Better Auth is mounted at `/api/auth/[...all]`; everything else sits under `/api/*` (spaces, teams, invitations).
- Path alias: `@/*` maps to `src/*` in every app and package.
