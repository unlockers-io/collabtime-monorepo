import { prisma } from "@repo/db";

import { readTeamSummaries } from "@/lib/team-store";

const displayName = (name: string | null, email: string): string => {
  if (name !== null && name !== "") {
    return name;
  }
  const localPart = email.split("@")[0];
  return localPart !== undefined && localPart !== "" ? localPart : "Someone";
};

const getMyTeams = async (userId: string) => {
  const memberships = await prisma.membership.findMany({
    orderBy: { createdAt: "desc" },
    where: { userId },
  });
  const teamIds = memberships.map((membership) => membership.teamId);
  const [summariesResult, ownedSpacesResult] = await Promise.allSettled([
    readTeamSummaries(teamIds),
    prisma.space.findMany({
      select: { id: true, teamId: true },
      where: { ownerId: userId, teamId: { in: teamIds } },
    }),
  ]);

  if (summariesResult.status === "rejected") {
    throw summariesResult.reason;
  }
  if (ownedSpacesResult.status === "rejected") {
    throw ownedSpacesResult.reason;
  }

  const ownedSpaceByTeamId = new Map(
    ownedSpacesResult.value.map((space) => [space.teamId, space.id]),
  );

  return memberships.flatMap((membership) => {
    const summary = summariesResult.value.get(membership.teamId);
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
        teamName: summary.name,
      },
    ];
  });
};

const getPendingInvitations = async (email: string) => {
  const invitations = await prisma.invitation.findMany({
    include: { invitedBy: { select: { email: true, name: true } } },
    orderBy: { createdAt: "desc" },
    where: { email, status: "PENDING" },
  });
  const summaries = await readTeamSummaries(invitations.map((invitation) => invitation.teamId));

  return invitations.map((invitation) => {
    const name = summaries.get(invitation.teamId)?.name ?? "";
    return {
      id: invitation.id,
      inviterName: displayName(invitation.invitedBy.name, invitation.invitedBy.email),
      memberId: invitation.memberId,
      teamId: invitation.teamId,
      teamName: name === "" ? "Unknown Team" : name,
    };
  });
};

export { getMyTeams, getPendingInvitations };
