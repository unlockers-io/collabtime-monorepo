---
title: 'oxlint 1.95 cannot lint with the pinned tsrs, and the newer tsrs is blocked by trustPolicy'
severity: 'minor'
---

## Expected Behavior

`pnpm up -r --latest` moves `oxlint` and `tsrs` forward together and `pnpm lint` keeps passing.

## Current Behavior

`oxlint@1.95.0` with `tsrs@0.25.0-ts7.1.0-beta` stops with `Error running tsgolint: unknown rule: no-unsafe-class-instance-assignment`. The newer `tsrs@7.1.0-beta.tsrs5` does not install: `ERR_PNPM_TRUST_DOWNGRADE`, because `trustPolicyExclude` only lists the pinned version. `prisma@7.10.1` is refused the same way, so the CLI stays on 7.10.0 while `@prisma/client` moves to 7.10.1.

## Possible Solution

Bump `tsrs` and `oxlint` in the same change, in the base first, and update the `tsrs` entry in `trustPolicyExclude` with it. Decide whether `prisma@7.10.1` gets an exclusion as 7.10.0 did.

## Minimal Reproducible Example

`pnpm up -r --latest`, then `pnpm add -Dw oxlint@1.95.0 && pnpm lint`.

## Context

Found while updating every dependency to latest. `oxlint` stays at 1.94.0 and `tsrs` at its pin until then.
