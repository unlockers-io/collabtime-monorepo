"use server";

import { db, joinRequest as joinRequestTable, membership as membershipTable } from "@repo/db";
import { and, asc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { log } from "@/lib/observability";
import { getTeamRole, requireAuth, requireTeamAdmin } from "@/lib/team-auth";
import type { TeamMember } from "@/types";

import { redis, TEAM_ACTIVE_TTL_SECONDS } from "../redis";
import { UUIDSchema } from "../validation";

import { getTeamRecord } from "./helpers";
import type { ActionResult } from "./types";

const requestToJoin = async (teamId: string): Promise<ActionResult<{ requestId: string }>> => {
  try {
    const session = await requireAuth();

    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { error: "Invalid team ID", success: false };
    }

    const [teamResult, membershipResult, requestResult] = await Promise.allSettled([
      getTeamRecord(teamId),
      db.query.membership.findFirst({
        where: and(eq(membershipTable.teamId, teamId), eq(membershipTable.userId, session.user.id)),
      }),
      db.query.joinRequest.findFirst({
        where: and(
          eq(joinRequestTable.teamId, teamId),
          eq(joinRequestTable.userId, session.user.id),
        ),
      }),
    ]);

    const team = teamResult.status === "fulfilled" ? teamResult.value : null;
    if (!team) {
      return { error: "Team not found", success: false };
    }

    const existingMembership =
      membershipResult.status === "fulfilled" ? membershipResult.value : null;
    if (existingMembership) {
      return { error: "You are already a member of this team", success: false };
    }

    const existingRequest = requestResult.status === "fulfilled" ? requestResult.value : null;
    if (existingRequest && existingRequest.status === "PENDING") {
      return { error: "You already have a pending request for this team", success: false };
    }

    const [joinRequest] = await db
      .insert(joinRequestTable)
      .values({
        id: uuidv4(),
        status: "PENDING",
        teamId,
        updatedAt: new Date().toISOString(),
        userId: session.user.id,
      })
      .onConflictDoUpdate({
        set: { status: "PENDING" },
        target: [joinRequestTable.userId, joinRequestTable.teamId],
      })
      .returning();

    return { data: { requestId: joinRequest.id }, success: true };
  } catch (error) {
    log.error({ error, message: "Failed to request to join", route: "actions/join-requests" });
    return { error: "Failed to submit join request", success: false };
  }
};

const approveJoinRequest = async (
  requestId: string,
): Promise<ActionResult<{ memberId: string }>> => {
  try {
    const joinRequest = await db.query.joinRequest.findFirst({
      where: eq(joinRequestTable.id, requestId),
      with: { user: true },
    });

    if (!joinRequest) {
      return { error: "Join request not found", success: false };
    }

    if (joinRequest.status !== "PENDING") {
      return { error: "Join request is no longer pending", success: false };
    }

    await requireTeamAdmin(joinRequest.teamId);

    // Update request status + create membership atomically
    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      await tx
        .update(joinRequestTable)
        .set({ status: "APPROVED" })
        .where(eq(joinRequestTable.id, requestId));
      await tx.insert(membershipTable).values({
        id: uuidv4(),
        role: "MEMBER",
        teamId: joinRequest.teamId,
        updatedAt: now,
        userId: joinRequest.userId,
      });
    });

    // Post-commit cache update (best-effort)
    const memberName = joinRequest.user.name || joinRequest.user.email.split("@")[0] || "Unknown";
    const team = await getTeamRecord(joinRequest.teamId);
    const newMember: TeamMember = {
      id: uuidv4(),
      name: memberName,
      order: team?.members.length ?? 0,
      timezone: "America/New_York",
      title: "",
      userId: joinRequest.userId,
      workingHoursEnd: 17,
      workingHoursStart: 9,
    };

    try {
      if (team) {
        team.members.push(newMember);
        await redis.set(
          `team:${joinRequest.teamId}`,
          JSON.stringify(team),
          "EX",
          TEAM_ACTIVE_TTL_SECONDS,
        );
      }
    } catch (cacheError) {
      log.error({
        error: cacheError,
        message: "Post-commit cache failed (approval committed)",
        route: "actions/join-requests",
      });
    }

    return { data: { memberId: newMember.id }, success: true };
  } catch (error) {
    log.error({ error, message: "Failed to approve join request", route: "actions/join-requests" });
    return { error: "Failed to approve join request", success: false };
  }
};

const denyJoinRequest = async (requestId: string): Promise<ActionResult<void>> => {
  try {
    const joinRequest = await db.query.joinRequest.findFirst({
      where: eq(joinRequestTable.id, requestId),
    });

    if (!joinRequest) {
      return { error: "Join request not found", success: false };
    }

    if (joinRequest.status !== "PENDING") {
      return { error: "Join request is no longer pending", success: false };
    }

    await requireTeamAdmin(joinRequest.teamId);

    await db
      .update(joinRequestTable)
      .set({ status: "DENIED" })
      .where(eq(joinRequestTable.id, requestId));

    return { data: undefined, success: true };
  } catch (error) {
    log.error({ error, message: "Failed to deny join request", route: "actions/join-requests" });
    return { error: "Failed to deny join request", success: false };
  }
};

const getPendingJoinRequests = async (
  teamId: string,
): Promise<
  ActionResult<
    Array<{ createdAt: Date; id: string; userEmail: string; userId: string; userName: string }>
  >
> => {
  try {
    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { error: "Invalid team ID", success: false };
    }

    await requireTeamAdmin(teamId);

    const requests = await db.query.joinRequest.findMany({
      orderBy: asc(joinRequestTable.createdAt),
      where: and(eq(joinRequestTable.status, "PENDING"), eq(joinRequestTable.teamId, teamId)),
      with: {
        user: {
          columns: {
            email: true,
            id: true,
            name: true,
          },
        },
      },
    });

    const data = requests.map((r) => ({
      createdAt: new Date(r.createdAt),
      id: r.id,
      userEmail: r.user.email,
      userId: r.userId,
      userName: r.user.name || r.user.email.split("@")[0] || "Unknown",
    }));

    return { data, success: true };
  } catch (error) {
    log.error({
      error,
      message: "Failed to get pending join requests",
      route: "actions/join-requests",
    });
    return { error: "Failed to get join requests", success: false };
  }
};

const getMyTeamStatus = async (
  teamId: string,
): Promise<ActionResult<{ status: "ADMIN" | "MEMBER" | "PENDING" | "none" }>> => {
  try {
    const session = await requireAuth();

    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { error: "Invalid team ID", success: false };
    }

    const teamRole = await getTeamRole(teamId);
    if (teamRole) {
      return { data: { status: teamRole.role }, success: true };
    }

    const pendingRequest = await db.query.joinRequest.findFirst({
      where: and(eq(joinRequestTable.teamId, teamId), eq(joinRequestTable.userId, session.user.id)),
    });

    if (pendingRequest && pendingRequest.status === "PENDING") {
      return { data: { status: "PENDING" }, success: true };
    }

    return { data: { status: "none" }, success: true };
  } catch (error) {
    log.error({ error, message: "Failed to get team status", route: "actions/join-requests" });
    return { error: "Failed to get team status", success: false };
  }
};

export {
  approveJoinRequest,
  denyJoinRequest,
  getMyTeamStatus,
  getPendingJoinRequests,
  requestToJoin,
};
