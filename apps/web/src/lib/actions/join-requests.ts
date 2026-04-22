"use server";

import { prisma } from "@repo/db";
import { v4 as uuidv4 } from "uuid";

import { getTeamRole, requireAuth, requireTeamAdmin } from "@/lib/team-auth";
import type { TeamMember } from "@/types";

import { realtime } from "../realtime";
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
      prisma.membership.findUnique({
        where: {
          userId_teamId: {
            teamId,
            userId: session.user.id,
          },
        },
      }),
      prisma.joinRequest.findUnique({
        where: {
          userId_teamId: {
            teamId,
            userId: session.user.id,
          },
        },
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

    const joinRequest = await prisma.joinRequest.upsert({
      create: {
        status: "PENDING",
        teamId,
        userId: session.user.id,
      },
      update: {
        status: "PENDING",
      },
      where: {
        userId_teamId: {
          teamId,
          userId: session.user.id,
        },
      },
    });

    return { data: { requestId: joinRequest.id }, success: true };
  } catch (error) {
    console.error("Failed to request to join:", error);
    return { error: "Failed to submit join request", success: false };
  }
};

const approveJoinRequest = async (
  requestId: string,
): Promise<ActionResult<{ memberId: string }>> => {
  try {
    const joinRequest = await prisma.joinRequest.findUnique({
      include: { user: true },
      where: { id: requestId },
    });

    if (!joinRequest) {
      return { error: "Join request not found", success: false };
    }

    if (joinRequest.status !== "PENDING") {
      return { error: "Join request is no longer pending", success: false };
    }

    await requireTeamAdmin(joinRequest.teamId);

    // Update request status + create membership atomically
    await prisma.$transaction([
      prisma.joinRequest.update({
        data: { status: "APPROVED" },
        where: { id: requestId },
      }),
      prisma.membership.create({
        data: {
          role: "MEMBER",
          teamId: joinRequest.teamId,
          userId: joinRequest.userId,
        },
      }),
    ]);

    // Post-commit side effects: cache + realtime (best-effort)
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
        await redis.set(`team:${joinRequest.teamId}`, JSON.stringify(team), {
          ex: TEAM_ACTIVE_TTL_SECONDS,
        });
      }
      await realtime.channel(`team-${joinRequest.teamId}`).emit("team.memberAdded", newMember);
    } catch (cacheError) {
      console.error("Post-commit cache/realtime failed (approval committed):", cacheError);
    }

    return { data: { memberId: newMember.id }, success: true };
  } catch (error) {
    console.error("Failed to approve join request:", error);
    return { error: "Failed to approve join request", success: false };
  }
};

const denyJoinRequest = async (requestId: string): Promise<ActionResult<void>> => {
  try {
    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
    });

    if (!joinRequest) {
      return { error: "Join request not found", success: false };
    }

    if (joinRequest.status !== "PENDING") {
      return { error: "Join request is no longer pending", success: false };
    }

    await requireTeamAdmin(joinRequest.teamId);

    await prisma.joinRequest.update({
      data: { status: "DENIED" },
      where: { id: requestId },
    });

    return { data: undefined, success: true };
  } catch (error) {
    console.error("Failed to deny join request:", error);
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

    const requests = await prisma.joinRequest.findMany({
      include: {
        user: {
          select: {
            email: true,
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      where: {
        status: "PENDING",
        teamId,
      },
    });

    const data = requests.map((r) => ({
      createdAt: r.createdAt,
      id: r.id,
      userEmail: r.user.email,
      userId: r.userId,
      userName: r.user.name || r.user.email.split("@")[0] || "Unknown",
    }));

    return { data, success: true };
  } catch (error) {
    console.error("Failed to get pending join requests:", error);
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

    const pendingRequest = await prisma.joinRequest.findUnique({
      where: {
        userId_teamId: {
          teamId,
          userId: session.user.id,
        },
      },
    });

    if (pendingRequest && pendingRequest.status === "PENDING") {
      return { data: { status: "PENDING" }, success: true };
    }

    return { data: { status: "none" }, success: true };
  } catch (error) {
    console.error("Failed to get team status:", error);
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
