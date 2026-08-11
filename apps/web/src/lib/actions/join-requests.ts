"use server";

import { prisma } from "@repo/db";

import { log } from "@/lib/observability";
import { requireAuth, requireTeamAdmin } from "@/lib/team-auth";

import { applyTeamContents, newTeamMember, readTeamRecord } from "../team-store";
import { UUIDSchema } from "../validation";

import type { ActionResult } from "./types";

const displayName = (name: string | null, email: string): string => {
  if (name !== null && name !== "") {
    return name;
  }
  const localPart = email.split("@")[0];
  return localPart !== undefined && localPart !== "" ? localPart : "Unknown";
};

const requestToJoin = async (teamId: string): Promise<ActionResult<{ requestId: string }>> => {
  try {
    const session = await requireAuth();

    const uuidResult = UUIDSchema.safeParse(teamId);
    if (!uuidResult.success) {
      return { error: "Invalid team ID", success: false };
    }

    const [teamResult, membershipResult, requestResult] = await Promise.allSettled([
      readTeamRecord(teamId),
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
    log.error({ error, message: "Failed to request to join", route: "actions/join-requests" });
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

    const memberName = displayName(joinRequest.user.name, joinRequest.user.email);

    const applied = await applyTeamContents(joinRequest.teamId, (team) => {
      if (team === null) {
        return { error: "Team not found", ok: false };
      }

      const member = newTeamMember({
        name: memberName,
        order: team.members.length,
        userId: joinRequest.userId,
      });
      team.members.push(member);

      return { ok: true, team, value: member.id };
    });

    if (!applied.ok) {
      log.error({
        message: "Approval committed but the member was not stored",
        reason: applied.reason,
        requestId,
        route: "actions/join-requests",
      });
      return {
        error:
          applied.reason === "read-failed" || applied.reason === "unconfigured"
            ? "The request was approved, but the team could not be reached. Try again in a moment."
            : "The request was approved, but adding the member failed. Add them from the team page.",
        success: false,
      };
    }

    return { data: { memberId: applied.value }, success: true };
  } catch (error) {
    log.error({ error, message: "Failed to approve join request", route: "actions/join-requests" });
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
      userName: displayName(r.user.name, r.user.email),
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

export { approveJoinRequest, denyJoinRequest, getPendingJoinRequests, requestToJoin };
