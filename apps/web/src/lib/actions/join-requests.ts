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
      return { success: false, error: "Invalid team ID" };
    }

    const team = await getTeamRecord(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (existingMembership) {
      return { success: false, error: "You are already a member of this team" };
    }

    const existingRequest = await prisma.joinRequest.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (existingRequest && existingRequest.status === "pending") {
      return { success: false, error: "You already have a pending request for this team" };
    }

    const joinRequest = await prisma.joinRequest.upsert({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
      update: {
        status: "pending",
      },
      create: {
        userId: session.user.id,
        teamId,
        status: "pending",
      },
    });

    return { success: true, data: { requestId: joinRequest.id } };
  } catch (error) {
    console.error("Failed to request to join:", error);
    return { success: false, error: "Failed to submit join request" };
  }
};

const approveJoinRequest = async (
  requestId: string,
): Promise<ActionResult<{ memberId: string }>> => {
  try {
    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!joinRequest) {
      return { success: false, error: "Join request not found" };
    }

    if (joinRequest.status !== "pending") {
      return { success: false, error: "Join request is no longer pending" };
    }

    await requireTeamAdmin(joinRequest.teamId);

    // Update request status + create membership atomically
    await prisma.$transaction([
      prisma.joinRequest.update({
        where: { id: requestId },
        data: { status: "approved" },
      }),
      prisma.membership.create({
        data: {
          userId: joinRequest.userId,
          teamId: joinRequest.teamId,
          role: "member",
        },
      }),
    ]);

    // Add TeamMember to Redis
    const team = await getTeamRecord(joinRequest.teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const memberName = joinRequest.user.name || joinRequest.user.email.split("@")[0] || "Unknown";

    const newMember: TeamMember = {
      id: uuidv4(),
      name: memberName,
      title: "",
      timezone: "America/New_York",
      workingHoursStart: 9,
      workingHoursEnd: 17,
      userId: joinRequest.userId,
    };

    team.members.push(newMember);

    await redis.set(`team:${joinRequest.teamId}`, JSON.stringify(team), {
      ex: TEAM_ACTIVE_TTL_SECONDS,
    });

    await realtime.channel(`team-${joinRequest.teamId}`).emit("team.memberAdded", newMember);

    return { success: true, data: { memberId: newMember.id } };
  } catch (error) {
    console.error("Failed to approve join request:", error);
    return { success: false, error: "Failed to approve join request" };
  }
};

const denyJoinRequest = async (requestId: string): Promise<ActionResult<void>> => {
  try {
    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
    });

    if (!joinRequest) {
      return { success: false, error: "Join request not found" };
    }

    if (joinRequest.status !== "pending") {
      return { success: false, error: "Join request is no longer pending" };
    }

    await requireTeamAdmin(joinRequest.teamId);

    await prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: "denied" },
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Failed to deny join request:", error);
    return { success: false, error: "Failed to deny join request" };
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
      return { success: false, error: "Invalid team ID" };
    }

    await requireTeamAdmin(teamId);

    const requests = await prisma.joinRequest.findMany({
      where: {
        teamId,
        status: "pending",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const data = requests.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name || r.user.email.split("@")[0] || "Unknown",
      userEmail: r.user.email,
      createdAt: r.createdAt,
    }));

    return { success: true, data };
  } catch (error) {
    console.error("Failed to get pending join requests:", error);
    return { success: false, error: "Failed to get join requests" };
  }
};

const getMyTeamStatus = async (
  teamId: string,
): Promise<ActionResult<{ status: "admin" | "member" | "pending" | "none" }>> => {
  try {
    const session = await requireAuth();

    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { success: false, error: "Invalid team ID" };
    }

    const teamRole = await getTeamRole(teamId);
    if (teamRole) {
      return { success: true, data: { status: teamRole.role } };
    }

    const pendingRequest = await prisma.joinRequest.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (pendingRequest && pendingRequest.status === "pending") {
      return { success: true, data: { status: "pending" } };
    }

    return { success: true, data: { status: "none" } };
  } catch (error) {
    console.error("Failed to get team status:", error);
    return { success: false, error: "Failed to get team status" };
  }
};

export {
  approveJoinRequest,
  denyJoinRequest,
  getMyTeamStatus,
  getPendingJoinRequests,
  requestToJoin,
};
