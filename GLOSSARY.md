# Glossary

Domain terms, and the module that owns each one. Paths are under `apps/web/src/`.

## Domain

- **Team**: the unit users collaborate in. Identified by `teamId`; the URL is `/{teamId}`.
- **Space**: the Postgres row that gives a team its owner, visibility (`isPrivate`) and access password. One per team, linked by `teamId`. The UI calls it a workspace.
- **Team contents**: a team's name, members and groups. Stored in PostgreSQL with the space, groups and members; live summaries read the same records. Redis carries live notifications. Owned by `lib/team-store.ts`, whose `applyTeamCommand` is the one path that locks the team, writes, changes access in the same transaction and publishes; the rules for changing it are the commands in `lib/team-commands.ts`, and `lib/team-changes.ts` lists every change a client can ask for.
- **Member**: a person on a team's roster, with a timezone, working hours and an optional group. A member can exist without an account.
- **Working window** (`workingWindow` in `lib/timezones.ts`): a member's hours as a start minute and a length. An end before the start runs past midnight; an end equal to the start means all day.
- **Member slot**: a member that a user has claimed (`userId` set). Claiming and releasing a slot are team contents commands.
- **Group**: a named set of members. A member whose `groupId` names a group that no longer exists is ungrouped (`isUngrouped` in `lib/team-schedule.ts`).
- **Membership**: the Postgres row that grants a user a role (`ADMIN` or `MEMBER`) on a team. A membership and its member slot change together: `lib/membership.ts` grants one with a slot claim (`grantMembership`) and revokes one with a member's removal (`revokeMemberAccess`). Password viewers get a membership without a slot (`grantViewerAccess`).
- **Invitation**: an email-bound offer to join a team as a given member. Its states are PENDING, ACCEPTED, DECLINED and REVOKED, and it expires after 14 days. Owned by `lib/invitations.ts`.
- **Join request**: a user's request for an admin to let them into a team.
- **Team access**: what a caller may do to a team. `lib/team-auth.ts` answers it for every entry point: the guards server actions open with, who may view a team (anyone for a public space, members and password holders for a private one), and the owner rule for visibility and deletion.
- **Viewer**: who is looking at a team page. That is their team access plus how they relate to the team: an open invitation or a pending join request. `resolveViewer` in `lib/team-viewer.ts` computes it.
- **Access cookie**: the signed per-space cookie that grants a guest access to a private space after they enter the password. Only `lib/workspace-access.ts` issues, reads or parses it; `lib/team-auth.ts` decides what it grants.

## Modules

- **Team cache**: the client's copy of a team and its invitations and join requests, all under `queryKeys.team.all(teamId)`. `useTeamQuery` (`hooks/use-team-query.ts`) reads the team, and every write goes through `useTeamWrite` (`hooks/use-team-write.ts`).
- **Team change**: a named entry in `lib/team-changes.ts` (schema, role, command). The server runs it through `changeTeam`; the client previews the same command optimistically.
- **Public team** (`lib/public-team.ts`): the team as one viewer may see it, with other people's account ids masked.
- **Live-sync protocol** (`lib/team-live-protocol.ts`): the SSE event names, URL, timings and access-loss statuses. The server stream and the client connection both import it.
- **Team schedule** (`lib/team-schedule.ts`): the overlap, best window and member rows for one instant. `getTeamSchedule` takes `now` explicitly and never reads the clock.
- **Member input** (`lib/member-input.ts`): one schema and normaliser for member data. The add and edit dialogs and CSV import all use it, and it derives from the server's `TeamMemberInputSchema`.
