"use server";

import { prisma } from "@repo/db";
import { v4 as uuidv4 } from "uuid";

import { log } from "@/lib/observability";
import { requireAuth } from "@/lib/team-auth";

import { applyTeamContents, newTeamMember } from "../team-store";

import { createTeamAction } from "./team-create-core";

const createTeam = createTeamAction({
  createId: uuidv4,
  createMember: newTeamMember,
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
  requireAuth,
  storeTeam: async (teamId, team, ttlSeconds) => {
    const result = await applyTeamContents(
      teamId,
      () => ({ ok: true, team, value: undefined }),
      ttlSeconds,
    );
    return result.ok ? { ok: true } : { ok: false, reason: result.reason };
  },
});

export { createTeam };
