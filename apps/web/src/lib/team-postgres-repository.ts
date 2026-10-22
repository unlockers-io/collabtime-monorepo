import type { Prisma } from "@repo/db";

import type { TeamMember, TeamRecord } from "@/types";

const memberFields = [
  "groupId",
  "id",
  "name",
  "order",
  "timezone",
  "title",
  "userId",
  "workingHoursEnd",
  "workingHoursStart",
] as const;

const INITIAL_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;
const ACTIVE_RETENTION_MS = 2 * 365 * 24 * 60 * 60 * 1000;

const readTeams = async (
  teamIds: Array<string>,
  transaction: Prisma.TransactionClient,
  refreshRetention = true,
): Promise<Array<TeamRecord>> => {
  const now = new Date();

  const spaces = await transaction.space.findMany({
    include: {
      groups: { orderBy: [{ order: "asc" }, { id: "asc" }] },
      members: { orderBy: [{ order: "asc" }, { id: "asc" }] },
    },
    where: { teamCreatedAt: { not: null }, teamExpiresAt: { gt: now }, teamId: { in: teamIds } },
  });

  if (refreshRetention && spaces.length > 0) {
    await transaction.space.updateMany({
      data: { teamExpiresAt: new Date(now.getTime() + ACTIVE_RETENTION_MS) },
      where: { teamExpiresAt: { gt: now }, teamId: { in: spaces.map((space) => space.teamId) } },
    });
  }

  return spaces.map((space) => {
    const team: TeamRecord = {
      createdAt: space.teamCreatedAt ?? "",
      groups: space.groups.map(({ id, name, order }) => ({ id, name, order })),
      id: space.teamId,
      members: space.members.map((row) => {
        const member: TeamMember = {
          id: row.id,
          name: row.name,
          order: row.order,
          timezone: row.timezone,
          title: row.title,
          workingHoursEnd: row.workingHoursEnd,
          workingHoursStart: row.workingHoursStart,
        };

        if (row.groupId !== null) {
          member.groupId = row.groupId;
        }

        if (row.userId !== null) {
          member.userId = row.userId;
        }

        return member;
      }),
      name: space.name,
    };

    if (space.adminPasswordHash !== null) {
      team.adminPasswordHash = space.adminPasswordHash;
    }

    return team;
  });
};

const writeTeam = async (
  teamId: string,
  team: TeamRecord,
  transaction: Prisma.TransactionClient,
  expiresAt?: Date,
): Promise<void> => {
  const previous = await transaction.space.findUniqueOrThrow({
    include: { groups: true, members: true },
    where: { teamId },
  });

  await transaction.space.update({
    data: {
      adminPasswordHash: team.adminPasswordHash ?? null,
      name: team.name,
      teamCreatedAt: team.createdAt,
      teamExpiresAt:
        expiresAt ??
        new Date(
          Date.now() +
            (previous.teamCreatedAt === null ? INITIAL_RETENTION_MS : ACTIVE_RETENTION_MS),
        ),
    },
    where: { teamId },
  });
  await transaction.teamMember.deleteMany({
    where: { id: { notIn: team.members.map((member) => member.id) }, teamId },
  });
  await transaction.teamGroup.deleteMany({
    where: { id: { notIn: team.groups.map((group) => group.id) }, teamId },
  });
  const oldGroups = new Map(previous.groups.map((group) => [group.id, group]));
  const oldMembers = new Map(previous.members.map((member) => [member.id, member]));

  for (const group of team.groups) {
    const old = oldGroups.get(group.id);

    if (!old || old.name !== group.name || old.order !== group.order) {
      await transaction.teamGroup.upsert({
        create: { ...group, teamId },
        update: { name: group.name, order: group.order },
        where: { id: group.id, teamId },
      });
    }
  }

  for (const member of team.members) {
    const data = { ...member, groupId: member.groupId ?? null, userId: member.userId ?? null };
    const old = oldMembers.get(member.id);

    if (!old || memberFields.some((field) => old[field] !== data[field])) {
      await transaction.teamMember.upsert({
        create: { ...data, teamId },
        update: data,
        where: { id: member.id, teamId },
      });
    }
  }
};

export { readTeams, writeTeam };
