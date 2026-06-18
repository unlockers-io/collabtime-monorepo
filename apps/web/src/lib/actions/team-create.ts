"use server";

import { db, membership as membershipTable, space as spaceTable } from "@repo/db";
import { v4 as uuidv4 } from "uuid";

import { log } from "@/lib/observability";
import { requireAuth } from "@/lib/team-auth";
import type { TeamMember, TeamRecord } from "@/types";

import { redis, TEAM_INITIAL_TTL_SECONDS } from "../redis";

import type { ActionResult } from "./types";

const createTeam = async (timezone: string): Promise<ActionResult<string>> => {
  try {
    const session = await requireAuth();

    const teamId = uuidv4();

    // Create Space + Membership atomically in Postgres
    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      await tx.insert(spaceTable).values({
        id: uuidv4(),
        isPrivate: false,
        ownerId: session.user.id,
        teamId,
        updatedAt: now,
      });
      await tx.insert(membershipTable).values({
        id: uuidv4(),
        role: "ADMIN",
        teamId,
        updatedAt: now,
        userId: session.user.id,
      });
    });

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

      await redis.set(`team:${teamId}`, JSON.stringify(team), "EX", TEAM_INITIAL_TTL_SECONDS);
    } catch (cacheError) {
      log.error({
        error: cacheError,
        message: "Post-commit Redis cache failed (team created in Postgres)",
        route: "actions/team-create",
      });
    }

    return { data: teamId, success: true };
  } catch (error) {
    log.error({ error, message: "Failed to create team", route: "actions/team-create" });
    return { error: "Failed to create team", success: false };
  }
};

export { createTeam };
