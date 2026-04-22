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

    // Post-commit: populate Redis cache (best-effort)
    try {
      const creatorMember: TeamMember = {
        id: uuidv4(),
        name: session.user.name ?? "",
        order: 0,
        timezone,
        title: "",
        userId: session.user.id,
        workingHoursEnd: 17,
        workingHoursStart: 9,
      };

      const team: TeamRecord = {
        createdAt: new Date().toISOString(),
        groups: [],
        id: teamId,
        members: [creatorMember],
        name: "",
      };

      await redis.set(`team:${teamId}`, JSON.stringify(team), {
        ex: TEAM_INITIAL_TTL_SECONDS,
      });
    } catch (cacheError) {
      console.error("Post-commit Redis cache failed (team created in Postgres):", cacheError);
    }

    return { data: teamId, success: true };
  } catch (error) {
    console.error("Failed to create team:", error);
    return { error: "Failed to create team", success: false };
  }
};

export { createTeam };
