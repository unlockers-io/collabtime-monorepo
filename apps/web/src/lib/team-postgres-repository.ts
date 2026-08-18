import { prisma } from "@repo/db";

import type { TeamMember, TeamRecord } from "../types";

type MirrorRow = {
  groupId: string | null;
  id: string;
  name: string;
  order: number;
  teamId: string;
  timezone: string;
  title: string;
  userId: string | null;
  workingHoursEnd: number;
  workingHoursStart: number;
};

type TeamSummary = {
  memberCount: number;
  name: string;
};

type TeamMirrorRow = {
  adminPasswordHash: string | null;
  createdAt: Date;
  groups: Array<{ id: string; name: string; order: number }>;
  members: Array<Omit<MirrorRow, "teamId">>;
  name: string;
  teamId: string;
};

type TeamSummaryRow = {
  members: Array<{ id: string }>;
  name: string;
  teamId: string;
};

type TeamPostgresReadDeps = {
  findTeamMirror: (teamId: string) => Promise<TeamMirrorRow | null>;
  findTeamSummaries: (teamIds: Array<string>) => Promise<Array<TeamSummaryRow>>;
};

const toMemberRow = (teamId: string, member: TeamMember): MirrorRow => ({
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
});

const toMember = (row: Omit<MirrorRow, "teamId">): TeamMember => ({
  ...(row.groupId === null ? {} : { groupId: row.groupId }),
  id: row.id,
  name: row.name,
  order: row.order,
  timezone: row.timezone,
  title: row.title,
  ...(row.userId === null ? {} : { userId: row.userId }),
  workingHoursEnd: row.workingHoursEnd,
  workingHoursStart: row.workingHoursStart,
});

/**
 * Replaces rather than diffs: the JSON blob is the whole record, so a full
 * rewrite is the only shape that cannot drift from it. Member and group ids come
 * from the blob, so identity survives the delete/recreate.
 *
 * Groups insert before members because a member's groupId is a real foreign key.
 */
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
        data: team.members.map((member) => toMemberRow(teamId, member)),
      });
    }
  });
};

const createTeamPostgresReader = (deps: TeamPostgresReadDeps) => {
  const readTeamSummariesFromPostgres = async (
    teamIds: Array<string>,
  ): Promise<Map<string, TeamSummary>> => {
    const spaces = await deps.findTeamSummaries(teamIds);

    return new Map(
      spaces.map((space) => [
        space.teamId,
        { memberCount: space.members.length, name: space.name },
      ]),
    );
  };

  const readTeamMirror = async (teamId: string): Promise<TeamRecord | null> => {
    const space = await deps.findTeamMirror(teamId);

    if (!space) {
      return null;
    }

    return {
      ...(space.adminPasswordHash === null ? {} : { adminPasswordHash: space.adminPasswordHash }),
      createdAt: space.createdAt.toISOString(),
      groups: space.groups.map((group) => ({
        id: group.id,
        name: group.name,
        order: group.order,
      })),
      id: space.teamId,
      members: space.members.map(toMember),
      name: space.name,
    };
  };

  return { readTeamMirror, readTeamSummariesFromPostgres };
};

const { readTeamMirror, readTeamSummariesFromPostgres } = createTeamPostgresReader({
  findTeamMirror: (teamId) =>
    prisma.space.findUnique({
      include: {
        groups: { orderBy: { order: "asc" } },
        members: { orderBy: { order: "asc" } },
      },
      where: { teamId },
    }),
  findTeamSummaries: (teamIds) =>
    prisma.space.findMany({
      select: { members: { select: { id: true } }, name: true, teamId: true },
      where: { teamId: { in: teamIds } },
    }),
});

const FIELD_SEPARATOR = "\u0000";

const canonicalGroups = (groups: TeamRecord["groups"]): string =>
  groups
    .toSorted((a, b) => a.id.localeCompare(b.id))
    .map((group) => [group.id, group.order, group.name].join(FIELD_SEPARATOR))
    .join("\n");

const canonicalMembers = (members: Array<TeamMember>): string =>
  members
    .toSorted((a, b) => a.id.localeCompare(b.id))
    .map((member) =>
      [
        member.id,
        member.order,
        member.name,
        member.title,
        member.timezone,
        member.workingHoursStart,
        member.workingHoursEnd,
        member.groupId ?? "",
        member.userId ?? "",
      ].join(FIELD_SEPARATOR),
    )
    .join("\n");

/**
 * `createdAt` is excluded on purpose: the blob carries the string the app wrote,
 * the mirror carries `Space.createdAt`, and for teams created before the space
 * row those two legitimately differ. Everything else must match exactly.
 */
const diffTeamMirror = (expected: TeamRecord, actual: TeamRecord | null): Array<string> => {
  if (actual === null) {
    return ["missing from Postgres"];
  }

  const problems: Array<string> = [];

  if (expected.name !== actual.name) {
    problems.push(`name "${expected.name}" != "${actual.name}"`);
  }
  if ((expected.adminPasswordHash ?? null) !== (actual.adminPasswordHash ?? null)) {
    problems.push("adminPasswordHash differs");
  }
  if (canonicalGroups(expected.groups) !== canonicalGroups(actual.groups)) {
    problems.push(`groups differ (${expected.groups.length} vs ${actual.groups.length})`);
  }
  if (canonicalMembers(expected.members) !== canonicalMembers(actual.members)) {
    problems.push(`members differ (${expected.members.length} vs ${actual.members.length})`);
  }

  return problems;
};

export {
  createTeamPostgresReader,
  diffTeamMirror,
  readTeamMirror,
  readTeamSummariesFromPostgres,
  writeTeamMirror,
};
export type { TeamSummary };
