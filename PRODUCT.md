# Product

## Platform

web

## Users

Distributed software teams — engineers, designers, PMs, and team leads spread across timezones. Primary situation: someone needs to schedule a meeting, plan a handoff, or simply know when a teammate is awake and working. Secondary audience: guests with a space link (a public space is readable with no account at all).

## Product Purpose

Collabtime is a team timezone visualizer. Teams create spaces, add members with timezones and working hours, and see everyone's day on one shared timeline. Success: a visitor finds the overlap window — the hour everyone is awake — in seconds, without mental timezone arithmetic.

## Positioning

The mechanism is the horizontal per-member day strip with a computed overlap: every teammate's working hours rendered against the viewer's local time, with the window where a meeting actually works made visible. Not a calendar, not a world clock — the overlap is the product's answer. Free and open source; there is no billing, no plans, no paid tier.

## Operating Context

- Web app used at a desk during the workday, usually while coordinating in Slack/calendar tools alongside it.
- Teams sync passively: data polls every 20s; members are grouped (e.g. Product / Engineering) and reorderable.
- Spaces can be private (password/access token) or public (link is enough, no session).
- Flows: create workspace → add/import members → share link; guests can request to join; admins approve.

## Capabilities and Constraints

- Core surfaces: landing page (logged out `/`), home dashboard (logged in `/`), team timezone view (`/[teamId]`), auth screens, settings.
- Timezone visualizer capabilities: time axis in viewer-local hours, per-member 24h strips at 15-minute precision (half-hour zones such as India are exact), current-time indicator, a best-time-to-meet sentence above the timeline (window in your time, who is free, when it starts or ends, hours every group is covered), per-person count toggles kept in the URL (`?without=`), group collapse (collapsed groups are not counted), legend.
- Team insights summarize the roster (spread, overlap stats).
- Stack is fixed: Next.js 16 App Router, React 19, Tailwind v4, Base UI, Motion, TanStack Query/Form, Better Auth, Prisma/Postgres, Redis.
- Terminology: "workspace"/"space" (the shareable container), "team" (the roster), "members" (people with timezone + working hours), "groups" (sub-teams), "overlap" (shared awake/working window).

## Brand Commitments

- Name: **Collabtime**. Product copy and factual claims are binding; visual identity is explicitly NOT pinned.
- Open source is part of the identity (landing has an Open Source section; GitHub link in nav).

## Evidence on Hand

- A real, working product demo: the landing page renders the actual `TimezoneVisualizer` against a static demo team (`apps/web/src/components/landing/demo-team.ts` — 5 members across LA / NY / Lisbon / Berlin / Singapore, picked so four of five share a real overlap window). Any mockup or marketing surface can truthfully show this data.
- No testimonials, customer logos, benchmarks, or pricing exist.

## Product Principles

- The overlap is the answer: every surface should make the shared window legible before anything else.
- Show the product doing its job — the real visualizer is the best marketing asset the product has.
- Times are always translated into the viewer's local frame; never make the user do timezone math.
- Guest-readable by design: public spaces work with zero session, so core views cannot depend on being logged in.
- Truth over claims: no invented social proof, no invented tiers (there is no billing).
