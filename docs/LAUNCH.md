# Collabtime launch kit

Drafts for the maintainer to review and publish. Live app: https://www.collabtime.io. Source: https://github.com/unlockers-io/collabtime-monorepo.

## Show HN

**Title:** Show HN: Collabtime – see your team's working hours on one timeline

**Body:**

I built Collabtime to make one question easier: when are the people I need actually working?

Add your teammates, their timezones, and working hours. Collabtime draws everyone on a shared timeline in your timezone and highlights the overlap. It writes out the best time to meet in your time and who is free then; leave anyone out with one click, import a roster from CSV, and share a public workspace without asking viewers to sign up. Private workspaces support password access and invitations.

The landing page has an interactive demo, so you can try the timeline before creating an account. The app is free and MIT licensed. There is no billing or paid tier.

It uses Next.js, React, Better Auth, Prisma/Postgres, and Redis. Team changes sync every 20 seconds. The timezone picker covers common locations; full IANA selection is a follow-up.

I'd appreciate feedback from people who schedule across regions: does the overlap view answer your question quickly, and where does it fall short?

Try it: https://www.collabtime.io
Source: https://github.com/unlockers-io/collabtime-monorepo

## Product Hunt

**Tagline:** Find the hour everyone is awake

**Description:** See your team's working hours on one timeline and get the best time to meet, written out in your timezone. Add people or import a CSV, organize groups, and share a public or password-protected workspace. Free and open source.

**First maker comment:**

Hi, I'm Pedro, the maker of Collabtime.

Coordinating across timezones often starts with a chain of clock conversions. I wanted to see the answer instead: everyone's working hours in one view, with the shared window highlighted.

You can try the interactive demo on the landing page. To use it with your team, create a workspace, add people or paste a CSV, then share the link. Public workspaces are readable without an account. Private workspaces have a password, and invited teammates can sign in and accept their invitation.

Collabtime is free and MIT licensed. I'd love to hear how it fits your team's scheduling habits, especially when there is little or no overlap.

**Suggested topics:** Productivity, Remote Work, Open Source, Collaboration, Scheduling.

## Gallery candidates

- [Desktop landing and live demo](assets/landing.png) — 1400px wide; README hero and primary gallery candidate.
- [Mobile landing](assets/landing-mobile.png) — 390px wide, full page; use for the mobile gallery.
- [Populated workspace](assets/team.png) — a local workspace with an imported sample roster.

All captures use local sample data. Review the gallery crops in Product Hunt before publication.

## Maintainer pre-launch checklist

- [ ] Confirm Vercel production `WEB_APP_URL=https://www.collabtime.io` and matching authentication host/origin settings.
- [ ] Confirm `EXPOSE_TESTING_API` is absent from production; never ship the testing API intentionally enabled.
- [ ] Confirm production `DATABASE_URL`, `DIRECT_DATABASE_URL`, and `REDIS_URL` point at the intended services. Team writes require Redis.
- [ ] Confirm `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are configured in production, then verify actual email delivery. Email verification is disabled without email configuration.
- [ ] Confirm security@collabtime.io is a monitored inbox before announcing the reporting policy.
- [ ] Review production Sentry configuration: routine session recording is off; error replays remain on.
- [ ] Star/watch the repository and enable GitHub Discussions.
- [ ] Review the MIT copyright attribution and launch drafts.
- [ ] After pushing, inspect the README on GitHub and confirm screenshot links render.
- [ ] Check the deployed signup, private-sharing, invitation, robots, and OG flows after deployment.
- [ ] Publish Show HN and Product Hunt manually when ready.

## Verification notes

On 2026-09-08, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` (333 tests), `pnpm fallow:dead`, and `pnpm build` passed. Lint reports four warnings: the team client's boolean props, two optional seed-property spreads, and a static skip-link detector that does not resolve the page-owned target. A direct page load has one `main` target; Next.js retains hidden pages during client navigation.

Chromium plus mobile Chromium: 19 passed, 13 skipped. Local Playwright API requests trust portless through `NODE_EXTRA_CA_CERTS="$HOME/.portless/ca.pem"`; use your own portless CA path on another machine. The build was checked with reporting disabled and without Sentry source-map upload credentials.

The GitHub description and requested topics are configured. No push, deployment, merge, or launch publication was performed.

The local review covers signup rejection at eight characters and success at twelve, the empty dashboard, workspace creation, CSV import, public/private toggling, guest password access, and invitation acceptance before the private gate. It also checks the seed timeline, Singapore viewer time, desktop/mobile presentation in both themes, headers, noindex metadata, FAQ JSON-LD, and recovery after failed team-content reads. The browser recovered after the test contents were restored; the retry button behavior is also covered by a component test.

The original member/group deletion E2E cases remain skipped: their broad `rounded` container selectors resolve to multiple nested containers. Creation coverage is enabled. Existing email integration suites need dedicated email credentials, and the pre-existing sync suites remain skipped; a green local run does not claim coverage from skipped tests.

Launch caps use simple checks: 200 members per workspace, 50 groups, and 50 administered workspaces per user, including archived memberships. CSV imports remain limited to 100 rows per request. These checks do not guarantee limits under simultaneous writes.

## Follow-ups

- Repair the legacy member/group deletion selectors and revisit skipped sync tests.
- Run email integration tests with a dedicated test inbox and Resend configuration.
- Full IANA timezone picker; current fuzzy viewer matching uses the nearest current UTC offset and may map to a region with different daylight-saving rules.
- Legal pages, analytics, OAuth, and settings email-change UI.
- Content Security Policy.
- Prisma migration history instead of production `db push`.
- Atomic write coordination if strict concurrent caps are needed.
