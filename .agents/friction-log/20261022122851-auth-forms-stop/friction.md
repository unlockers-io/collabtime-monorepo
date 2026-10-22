---
title: 'Auth forms stop re-rendering their fields in jsdom while use(searchParams) suspends'
severity: 'minor'
---

## Expected Behavior

Rendering `LoginForm` (or `RegisterForm`) in a Vitest jsdom test with `searchParams={Promise.resolve({})}` re-renders each `form.Field` when TanStack Form updates its state, so a failed submit shows its errors.

## Current Behavior

The sign-up/sign-in link sibling calls `use(searchParams)` inside a `Suspense` boundary. With a plain resolved promise, the form store updates correctly (`fieldMeta.isValid` is false, errors are set) but the fields never re-render, so `aria-invalid` stays `false` and no error appears. Only component `useState` updates re-render the tree. The same component works in real browsers (the Playwright specs pass).

## Possible Solution

Tests pass a fulfilled thenable so `use()` reads it without suspending: `Object.assign(Promise.resolve({}), { status: "fulfilled", value: {} })`. `apps/web/src/app/(auth)/login/form.test.tsx` does this. A shared test helper would save the next person the bisect.

## Minimal Reproducible Example

Render `<LoginForm searchParams={Promise.resolve({})} />`, click "Sign in" with empty fields, wait, and read `aria-invalid` on the email input: it stays `false`. Replace the promise with the fulfilled thenable and it becomes `true`.

## Context

Found while adding unit tests for the form validation standard (validate on submit, then on every change).
