import { prisma } from "@repo/db";

import type { TeamRecord } from "../types";

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

export { writeTeamMirror };
