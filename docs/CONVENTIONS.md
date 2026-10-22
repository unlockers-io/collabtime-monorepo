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
- `vi.mock` is lint-banned (`anti-slop/no-module-mocking`). Render a `*View` component that takes its action as a prop instead. A test that has to mock a framework boundary (a server action, `next/navigation`, the auth client) is allowlisted by exact path in `oxlint.config.ts`.

## Time display

- Times are always 24-hour `HH:MM`. There is no 12-hour mode and no preference for one.
- Format through `formatMinuteOfDay` / `formatMinuteRange` in `apps/web/src/lib/timezones.ts` or `formatHour` in `lib/utils.ts`. Never hand a time to `toLocaleTimeString` or an `Intl.DateTimeFormat` without `hourCycle: "h23"`: the locale default can be 12-hour.

## Forms

- `@tanstack/react-form`, never `react-hook-form`.
- Schemas are the single source of validation: no HTML `required`, `minLength` or `maxLength`. Keep `noValidate` on the form, `type="email"` for keyboard hints, `aria-required` on required inputs, and `type="submit"` on submit buttons.
- Validation follows six rules:
  1. Validate on submit, then on every change: `validationLogic: revalidateLogic()` with `validators: { onDynamic: schema }`. No error shows before the first submit attempt, and after a failed one an error clears on the keystroke that fixes it. Never validate on blur. Put every rule in the one form-level schema, never in field-level `validators`: TanStack runs form-level validators on submit only after field-level ones pass, so a form mixing the two shows partial errors.
  2. Show a field's error whenever `!field.state.meta.isValid`. Don't add an `isTouched`, `isBlurred` or `submissionAttempts` check: rule 1 already holds errors back until submit. `bindField` in `apps/web/src/hooks/use-member-form.ts` does this for the member dialogs.
  3. On a failed submit, `onSubmitInvalid` calls `focusFirstInvalidField(formApi.formId)` from `@repo/ui/lib/focus-first-invalid-field`, and the form renders with `id={form.formId}` (React's `useId`, so server and client agree). The helper focuses the form's first `[aria-invalid="true"]` control a frame later, because TanStack calls `onSubmitInvalid` before React renders the invalid state, while controls may still be disabled. Call `form.handleSubmit()` outside `startTransition`; start the transition inside `onSubmit`.
  4. Explain any rule people can't guess (password length, name and group length, allowed characters) with a `FieldDescription` under the field from the start, keep it beside the error, and describe the input by both. Live hints such as a strength meter derive from the value; they are not validation errors.
  5. Server-only failures (wrong password, email taken, rate limits) arrive on submit. Attach each one to its field, as the private workspace gate does with "Incorrect password", or render it in `FormAlert` from `@repo/ui/compositions/form-alert` at the top of the form, set when the submit fails and cleared by the form's `listeners: { onChange }`. Auth forms pass `authErrorMessage(kind)` from `apps/web/src/app/(auth)/auth-error.tsx`, which keeps the recovery links. Never report a submit failure in a toast: it disappears on its own, sits apart from the form, and doesn't clear on change. Toasts are for successes and for actions outside a form, such as copying a link, inline renames, removals, drag and drop, and the invitation the add-member dialog sends after it has closed. Keep auth failures generic.
  6. Keep the submit button enabled, and disable it only while submitting. Never disable it on `!canSubmit` or `!isValid`: a disabled button can't say which field is wrong. The one exception is a form with exactly one editable field, which may also disable submit while that field's trimmed value is empty or unchanged; use it only where empty is the obvious error, such as naming a workspace or a group. A form with more than one editable field never disables submit while unchanged: an unchanged submit sends nothing and says "No changes to save." in `FormAlert`. A client-side throttle refuses an early submit with a `FormAlert` that says when to retry instead of disabling the button.
- An input that can't be its own TanStack form, such as the invite section nested inside the edit-member form, follows the same rules by hand: remember that a submit was attempted, re-run the same check on every change after that, take its id from `useId()`, render it on the wrapping `Field`, and focus through `focusFirstInvalidField`.
- Never call `field.handleChange` inside `useEffect` or `useCallback` with `field` in deps; use `field.form.setFieldValue(field.name, value)` with stable refs.

## Tooling

- Linter: oxlint. Not ESLint.
- Formatter: oxfmt. Not Prettier.
- Bundler (library packages: `@repo/db`, `@repo/transactional`): tsdown.
- Bundler (web): Next.js' Turbopack in dev, native in build.

## Routes

- Better Auth is mounted at `/api/auth/[...all]`; everything else sits under `/api/*` (spaces, teams, invitations).
- Path alias: `@/*` maps to `src/*` in every app and package.
