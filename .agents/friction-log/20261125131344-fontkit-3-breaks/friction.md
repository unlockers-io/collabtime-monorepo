---
title: 'fontkit 3 breaks the build, the opengraph image fails to prerender'
severity: 'minor'
issue: 'unlockers-io/collabtime-monorepo#379'
---

## Expected Behavior

`pnpm build` passes with `fontkit@3.0.0` in `@repo/social-image`.

## Current Behavior

`next build` fails while prerendering `/_not-found`: `TypeError: The "path" argument must be of type string or an instance of Buffer or URL. Received an instance of URL`, raised from the module evaluation of `src/app/opengraph-image`. Typecheck and the `@repo/social-image` tests pass, only the bundled build fails.

## Possible Solution

Find what fontkit 3 reads from disk at import time and whether Turbopack can bundle it, or keep the 2.0.4 pin and say why next to it.

## Minimal Reproducible Example

`pnpm --filter @repo/social-image add fontkit@3.0.0 && pnpm build`.

## Context

Found while updating every dependency to latest. `fontkit` stays at 2.0.4.
