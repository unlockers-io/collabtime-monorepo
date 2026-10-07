# Glossary

Domain terms, and the module that owns each one. Paths are under `apps/web/src/`.

## Domain

- **Team**: the unit users collaborate in. Identified by `teamId`; the URL is `/{teamId}`.
- **Space**: the Postgres row that gives a team its owner, visibility (`isPrivate`) and access password. One per team, linked by `teamId`. The UI calls it a workspace.
- **Team contents**: a team's name, members and groups. Stored as JSON in Redis under `team:<teamId>` and mirrored to Postgres for summaries. Owned by `lib/team-store.ts`; the rules for changing it are the commands in `lib/team-commands.ts`.
- **Member**: a person on a team's roster, with a timezone, working hours and an optional group. A member can exist without an account.
- **Member slot**: a member that a user has claimed (`userId` set). Claiming and releasing a slot are team contents commands.
- **Group**: a named set of members. A member whose `groupId` names a group that no longer exists is ungrouped (`isUngrouped` in `lib/team-schedule.ts`).
- **Membership**: the Postgres row that grants a user a role (`ADMIN` or `MEMBER`) on a team. A membership and its member slot change together through `lib/membership.ts` (`grantMembership`, `revokeMembership`). Password viewers get a membership without a slot.
- **Invitation**: an email-bound offer to join a team as a given member. Its states are PENDING, ACCEPTED, DECLINED and REVOKED, and it expires after 14 days. Owned by `lib/invitations.ts`.
- **Join request**: a user's request for an admin to let them into a team.
- **Viewer**: who is looking at a team and what they may do. That covers their role, an open invitation, a pending join request, a guest grant from the access cookie, and owner status. `resolveViewer` in `lib/workspace-access.ts` computes it, and every access decision reads it.
- **Access cookie**: the signed per-space cookie that grants a guest access to a private space after they enter the password. Only `lib/workspace-access.ts` issues, reads or parses it.

## Modules

- **Team cache** (`hooks/use-team-cache.ts`): the client's copy of a team. `useTeamQuery` reads it, and every team write goes through `useTeamWrite`.
- **Live-sync protocol** (`lib/team-live-protocol.ts`): the SSE event names, URL, timings and access-loss statuses. The server stream and the client connection both import it.
- **Team schedule** (`lib/team-schedule.ts`): the overlap, best window and member rows for one instant. `getTeamSchedule` takes `now` explicitly and never reads the clock.
- **Member input** (`lib/member-input.ts`): one schema and normaliser for member data. The add and edit dialogs and CSV import all use it, and it derives from the server's `TeamMemberInputSchema`.
