import { prisma } from "@repo/db";

import type { TeamRecord } from "../types";

type TeamSummary = {
  memberCount: number;
  name: string;
};

const writeTeamMirror = async (teamId: string, team: TeamRecord): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await tx.space.update({
      data: {
        adminPasswordHash: team.adminPasswordHash ?? null,
        name: team.name,
      },
      where: { teamId },
    });

    await tx.teamMember.deleteMany({ where: { teamId } });
    await tx.teamGroup.deleteMany({ where: { teamId } });

    if (team.groups.length > 0) {
      await tx.teamGroup.createMany({
        data: team.groups.map((group) => ({
          id: group.id,
          name: group.name,
          order: group.order,
          teamId,
        })),
      });
    }

    if (team.members.length > 0) {
      await tx.teamMember.createMany({
        data: team.members.map((member) => ({
          groupId: member.groupId ?? null,
          id: member.id,
          name: member.name,
          order: member.order,
          teamId,
          timezone: member.timezone,
          title: member.title,
          userId: member.userId ?? null,
          workingHoursEnd: member.workingHoursEnd,
          workingHoursStart: member.workingHoursStart,
        })),
      });
    }
  });
};

const readTeamSummariesFromPostgres = async (
  teamIds: Array<string>,
): Promise<Map<string, TeamSummary>> => {
  const spaces = await prisma.space.findMany({
    select: { _count: { select: { members: true } }, name: true, teamId: true },
    where: { teamId: { in: teamIds } },
  });

  return new Map(
    spaces.map((space) => [space.teamId, { memberCount: space._count.members, name: space.name }]),
  );
};

export { readTeamSummariesFromPostgres, writeTeamMirror };
export type { TeamSummary };
