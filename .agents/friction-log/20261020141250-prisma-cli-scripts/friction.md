---
title: 'Prisma CLI scripts leave their external PostgreSQL pool open'
severity: 'minor'
issue: 'unlockers-io/collabtime-monorepo#327'
---

## Expected Behavior

CLI scripts exit promptly after `prisma.$disconnect()`.

## Current Behavior

The shared client supplies an external `pg.Pool` without enabling adapter disposal. A PostgreSQL-reading cutover subprocess stays alive until the idle timeout, so four invocations exceed a 20-second test deadline.

## Possible Solution

Set PrismaPg's supported `disposeExternalPool: true` option. Implemented with the team-store remediation and exercised by the cutover subprocess integration tests.

## Minimal Reproducible Example

Run the team-store cutover against a disposable populated database, call `prisma.$disconnect()`, and measure the time between its final output and process exit.

## Context

Encountered while validating the explicit Redis-to-PostgreSQL cutover for collabtime-01. No production resources were used.
