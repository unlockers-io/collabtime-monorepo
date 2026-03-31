"use server";

import { prisma } from "@repo/db";
import { v4 as uuidv4 } from "uuid";

import { requireAuth } from "@/lib/team-auth";
import type { TeamMember, TeamRecord } from "@/types";

import { redis, TEAM_INITIAL_TTL_SECONDS } from "../redis";

import type { ActionResult } from "./types";

const createTeam = async (timezone: string): Promise<ActionResult<string>> => {
  try {
    const session = await requireAuth();

    const teamId = uuidv4();

    // Create Space + Membership atomically in Postgres
    await prisma.$transaction([
      prisma.space.create({
        data: {
          teamId,
          isPrivate: false,
          ownerId: session.user.id,
        },
      }),
      prisma.membership.create({
        data: {
          userId: session.user.id,
          teamId,
          role: "ADMIN",
        },
      }),
    ]);

    // Post-commit: populate Redis cache (best-effort)
    try {
      const creatorMember: TeamMember = {
        id: uuidv4(),
        name: session.user.name ?? "",
        timezone,
        title: "",
        workingHoursStart: 9,
        workingHoursEnd: 17,
        order: 0,
        userId: session.user.id,
      };

      const team: TeamRecord = {
        id: teamId,
        name: "",
        createdAt: new Date().toISOString(),
        members: [creatorMember],
        groups: [],
      };

      await redis.set(`team:${teamId}`, JSON.stringify(team), {
        ex: TEAM_INITIAL_TTL_SECONDS,
      });
    } catch (cacheError) {
      console.error("Post-commit Redis cache failed (team created in Postgres):", cacheError);
    }

    return { success: true, data: teamId };
  } catch (error) {
    console.error("Failed to create team:", error);
    return { success: false, error: "Failed to create team" };
  }
};

export { createTeam };
