"use server";

import { prisma } from "@repo/db";
import { v4 as uuidv4 } from "uuid";

import { log } from "@/lib/observability";
import { authenticate } from "@/lib/team-auth";

import { newTeamMember } from "../team-commands";
import { createTeamContents } from "../team-store";

import { createTeamAction } from "./team-create-core";

const createTeam = createTeamAction({
  authenticate,
  countAdminTeams: (userId) => prisma.membership.count({ where: { role: "ADMIN", userId } }),
  createId: uuidv4,
  createMember: (overrides) => newTeamMember(uuidv4(), overrides),
  createTeamRecords: async (userId, teamId) => {
    await prisma.$transaction([
      prisma.space.create({ data: { isPrivate: false, ownerId: userId, teamId } }),
      prisma.membership.create({ data: { role: "ADMIN", teamId, userId } }),
    ]);
  },
  deleteSpace: async (teamId) => {
    await prisma.space.delete({ where: { teamId } });
  },
  now: () => new Date(),
  reportError: log.error,
  storeTeam: createTeamContents,
});

export { createTeam };
