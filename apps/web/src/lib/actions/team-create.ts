"use server";

import { prisma } from "@repo/db";
import { v4 as uuidv4 } from "uuid";

import { log } from "@/lib/observability";
import { requireAuth } from "@/lib/team-auth";

import { TEAM_INITIAL_TTL_SECONDS } from "../redis";
import { applyTeamContents, newTeamMember } from "../team-store";

import type { ActionResult } from "./types";

const createTeam = async (timezone: string): Promise<ActionResult<string>> => {
  try {
    const session = await requireAuth();

    const teamId = uuidv4();

    await prisma.$transaction([
      prisma.space.create({
        data: {
          isPrivate: false,
          ownerId: session.user.id,
          teamId,
        },
      }),
      prisma.membership.create({
        data: {
          role: "ADMIN",
          teamId,
          userId: session.user.id,
        },
      }),
    ]);

    const applied = await applyTeamContents(
      teamId,
      () => ({
        ok: true,
        team: {
          createdAt: new Date().toISOString(),
          groups: [],
          id: teamId,
          members: [
            newTeamMember({ name: session.user.name ?? "", timezone, userId: session.user.id }),
          ],
          name: "",
        },
        value: undefined,
      }),
      TEAM_INITIAL_TTL_SECONDS,
    );

    if (!applied.ok) {
      log.error({
        message: "Space and membership committed but the team contents were not stored",
        reason: applied.reason,
        route: "actions/team-create",
        teamId,
      });
      return { error: "Failed to create team", success: false };
    }

    return { data: teamId, success: true };
  } catch (error) {
    log.error({ error, message: "Failed to create team", route: "actions/team-create" });
    return { error: "Failed to create team", success: false };
  }
};

export { createTeam };
