"use server";

import { prisma } from "@repo/db";
import { v4 as uuidv4 } from "uuid";

import { log } from "@/lib/observability";
import { authenticate } from "@/lib/team-auth";

import { grantMembership } from "../membership";
import { newTeamMember } from "../team-commands";
import { createTeamContents } from "../team-store";

import { createTeamAction } from "./team-create-core";

const createTeam = createTeamAction({
  authenticate,
  countAdminTeams: (userId) => prisma.membership.count({ where: { role: "ADMIN", userId } }),
  createId: uuidv4,
  createMember: (overrides) => newTeamMember(uuidv4(), overrides),
  createSpace: async (userId, teamId) => {
    await prisma.space.create({ data: { isPrivate: false, ownerId: userId, teamId } });
  },
  deleteSpace: async (teamId) => {
    await prisma.space.delete({ where: { teamId } });
  },
  grantMembership,
  now: () => new Date(),
  reportError: log.error,
  storeTeam: createTeamContents,
});

export { createTeam };
