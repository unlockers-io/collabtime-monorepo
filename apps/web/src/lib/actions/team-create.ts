"use server";

import { prisma } from "@repo/db";
import { v4 as uuidv4 } from "uuid";

import { requireAuth } from "@/lib/team-auth";
import type { TeamRecord } from "@/types";

import { redis, TEAM_INITIAL_TTL_SECONDS } from "../redis";

import type { ActionResult } from "./types";

const createTeam = async (): Promise<ActionResult<string>> => {
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
          role: "admin",
        },
      }),
    ]);

    // Write Redis record last so Postgres is the source of truth
    const team: TeamRecord = {
      id: teamId,
      name: "",
      createdAt: new Date().toISOString(),
      members: [],
      groups: [],
    };

    await redis.set(`team:${teamId}`, JSON.stringify(team), {
      ex: TEAM_INITIAL_TTL_SECONDS,
    });

    return { success: true, data: teamId };
  } catch (error) {
    console.error("Failed to create team:", error);
    return { success: false, error: "Failed to create team" };
  }
};

export { createTeam };
