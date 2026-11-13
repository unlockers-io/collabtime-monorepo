import { getPrisma } from "@/lib/db";
import { readTeamSummaries } from "@/lib/team-store";

import { displayName, workspaceName } from "./display-name";
import type { MyTeam, PendingInvitation } from "./home-lists";
import { invitations } from "./invitations";

const getMyTeams = async (userId: string): Promise<Array<MyTeam>> => {
  const memberships = await getPrisma().membership.findMany({
    orderBy: { createdAt: "desc" },
    where: { userId },
  });

  const teamIds = memberships.map((membership) => membership.teamId);

  const [summaries, ownedSpaces] = await Promise.all([
    readTeamSummaries(teamIds),
    getPrisma().space.findMany({
      select: { id: true, teamId: true },
      where: { ownerId: userId, teamId: { in: teamIds } },
    }),
  ]);

  const ownedSpaceByTeamId = new Map(ownedSpaces.map((space) => [space.teamId, space.id]));

  return memberships.flatMap((membership) => {
    const summary = summaries.get(membership.teamId);

    if (summary === undefined) {
      return [];
    }

    return [
      {
        archivedAt: membership.archivedAt?.toISOString() ?? null,
        memberCount: summary.memberCount,
        role: membership.role,
        spaceId: ownedSpaceByTeamId.get(membership.teamId) ?? null,
        teamId: membership.teamId,
        teamName: workspaceName(summary.name),
      },
    ];
  });
};

const getPendingInvitations = async (email: string): Promise<Array<PendingInvitation>> => {
  const open = await invitations.listOpenForEmail(email);
  const summaries = await readTeamSummaries(open.map((invitation) => invitation.teamId));

  return open.map((invitation) => {
    return {
      expiresAt: invitation.expiresAt?.toISOString() ?? null,
      id: invitation.id,
      inviterName: displayName(invitation.invitedBy.name, invitation.invitedBy.email),
      teamId: invitation.teamId,
      teamName: workspaceName(summaries.get(invitation.teamId)?.name),
    };
  });
};

export { getMyTeams, getPendingInvitations };
