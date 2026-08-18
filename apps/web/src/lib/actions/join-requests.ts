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

type JoinRequestRecord = {
  id: string;
  status: string;
  teamId: string;
  user: { email: string; name: string | null };
  userId: string;
};

type PendingJoinRequest = JoinRequestRecord & { createdAt: Date };

type PendingJoinRequestView = {
  createdAt: Date;
  id: string;
  userEmail: string;
  userId: string;
  userName: string;
};

type TeamMemberWriteResult =
  | { memberId: string; ok: true }
  | { ok: false; reason: "read-failed" | "rejected" | "unconfigured" | "write-failed" };

type JoinRequestDeps = {
  addTeamMember: (teamId: string, userId: string, name: string) => Promise<TeamMemberWriteResult>;
  approveMembership: (requestId: string, teamId: string, userId: string) => Promise<void>;
  denyRequest: (requestId: string) => Promise<void>;
  findRequest: (requestId: string) => Promise<JoinRequestRecord | null>;
  listPending: (
    teamId: string,
  ) => Promise<{ memberUserIds: Array<string>; requests: Array<PendingJoinRequest> }>;
  loadJoinContext: (
    teamId: string,
    userId: string,
  ) => Promise<{
    existingMembership: boolean;
    existingRequest: { status: string } | null;
    teamExists: boolean;
  }>;
  reportError: (event: Record<string, unknown>) => void;
  requireAuth: typeof requireAuth;
  requireTeamAdmin: typeof requireTeamAdmin;
  upsertRequest: (teamId: string, userId: string) => Promise<{ id: string }>;
};

const createJoinRequestActions = (deps: JoinRequestDeps) => {
  const requestToJoin = async (teamId: string): Promise<ActionResult<{ requestId: string }>> => {
    try {
      const session = await deps.requireAuth();
      const uuidResult = UUIDSchema.safeParse(teamId);
      if (!uuidResult.success) {
        return { error: "Invalid team ID", success: false };
      }

      const context = await deps.loadJoinContext(teamId, session.user.id);
      if (!context.teamExists) {
        return { error: "Team not found", success: false };
      }
      if (context.existingMembership) {
        return { error: "You are already a member of this team", success: false };
      }
      if (context.existingRequest?.status === "PENDING") {
        return { error: "You already have a pending request for this team", success: false };
      }

      const joinRequest = await deps.upsertRequest(teamId, session.user.id);
      return { data: { requestId: joinRequest.id }, success: true };
    } catch (error) {
      deps.reportError({
        error,
        message: "Failed to request to join",
        route: "actions/join-requests",
      });
      return { error: "Failed to submit join request", success: false };
    }
  };

  const approveJoinRequest = async (
    requestId: string,
  ): Promise<ActionResult<{ memberId: string }>> => {
    try {
      const joinRequest = await deps.findRequest(requestId);
      if (!joinRequest) {
        return { error: "Join request not found", success: false };
      }
      if (joinRequest.status !== "PENDING") {
        return { error: "Join request is no longer pending", success: false };
      }

      await deps.requireTeamAdmin(joinRequest.teamId);
      await deps.approveMembership(requestId, joinRequest.teamId, joinRequest.userId);

      const memberName = displayName(joinRequest.user.name, joinRequest.user.email);
      const applied = await deps.addTeamMember(joinRequest.teamId, joinRequest.userId, memberName);
      if (!applied.ok) {
        deps.reportError({
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

      return { data: { memberId: applied.memberId }, success: true };
    } catch (error) {
      deps.reportError({
        error,
        message: "Failed to approve join request",
        route: "actions/join-requests",
      });
      return { error: "Failed to approve join request", success: false };
    }
  };

  const denyJoinRequest = async (requestId: string): Promise<ActionResult<void>> => {
    try {
      const joinRequest = await deps.findRequest(requestId);
      if (!joinRequest) {
        return { error: "Join request not found", success: false };
      }
      if (joinRequest.status !== "PENDING") {
        return { error: "Join request is no longer pending", success: false };
      }

      await deps.requireTeamAdmin(joinRequest.teamId);
      await deps.denyRequest(requestId);
      return { data: undefined, success: true };
    } catch (error) {
      deps.reportError({
        error,
        message: "Failed to deny join request",
        route: "actions/join-requests",
      });
      return { error: "Failed to deny join request", success: false };
    }
  };

  const getPendingJoinRequests = async (
    teamId: string,
  ): Promise<ActionResult<Array<PendingJoinRequestView>>> => {
    try {
      const uuidResult = UUIDSchema.safeParse(teamId);
      if (!uuidResult.success) {
        return { error: "Invalid team ID", success: false };
      }

      await deps.requireTeamAdmin(teamId);
      const { memberUserIds, requests } = await deps.listPending(teamId);
      const existingMembers = new Set(memberUserIds);
      const data: Array<PendingJoinRequestView> = [];
      for (const request of requests) {
        if (!existingMembers.has(request.userId)) {
          data.push({
            createdAt: request.createdAt,
            id: request.id,
            userEmail: request.user.email,
            userId: request.userId,
            userName: displayName(request.user.name, request.user.email),
          });
        }
      }

      return { data, success: true };
    } catch (error) {
      deps.reportError({
        error,
        message: "Failed to get pending join requests",
        route: "actions/join-requests",
      });
      return { error: "Failed to get join requests", success: false };
    }
  };

  return { approveJoinRequest, denyJoinRequest, getPendingJoinRequests, requestToJoin };
};

const joinRequestActions = createJoinRequestActions({
  addTeamMember: async (teamId, userId, name) => {
    const applied = await applyTeamContents(teamId, (team) => {
      if (team === null) {
        return { error: "Team not found", ok: false };
      }
      const member = newTeamMember({ name, order: team.members.length, userId });
      team.members.push(member);
      return { ok: true, team, value: member.id };
    });
    return applied.ok
      ? { memberId: applied.value, ok: true }
      : { ok: false, reason: applied.reason };
  },
  approveMembership: async (requestId, teamId, userId) => {
    await prisma.$transaction([
      prisma.joinRequest.update({ data: { status: "APPROVED" }, where: { id: requestId } }),
      prisma.membership.upsert({
        create: { role: "MEMBER", teamId, userId },
        update: { archivedAt: null },
        where: { userId_teamId: { teamId, userId } },
      }),
    ]);
  },
  denyRequest: async (requestId) => {
    await prisma.joinRequest.update({ data: { status: "DENIED" }, where: { id: requestId } });
  },
  findRequest: (requestId) =>
    prisma.joinRequest.findUnique({ include: { user: true }, where: { id: requestId } }),
  listPending: async (teamId) => {
    const [requests, memberships] = await Promise.all([
      prisma.joinRequest.findMany({
        include: { user: { select: { email: true, id: true, name: true } } },
        orderBy: { createdAt: "asc" },
        where: { status: "PENDING", teamId },
      }),
      prisma.membership.findMany({ select: { userId: true }, where: { teamId } }),
    ]);
    return { memberUserIds: memberships.map((membership) => membership.userId), requests };
  },
  loadJoinContext: async (teamId, userId) => {
    const [team, existingMembership, existingRequest] = await Promise.all([
      readTeamRecord(teamId),
      prisma.membership.findUnique({ where: { userId_teamId: { teamId, userId } } }),
      prisma.joinRequest.findUnique({ where: { userId_teamId: { teamId, userId } } }),
    ]);
    return {
      existingMembership: existingMembership !== null,
      existingRequest,
      teamExists: team !== null,
    };
  },
  reportError: log.error,
  requireAuth,
  requireTeamAdmin,
  upsertRequest: (teamId, userId) =>
    prisma.joinRequest.upsert({
      create: { status: "PENDING", teamId, userId },
      update: { status: "PENDING" },
      where: { userId_teamId: { teamId, userId } },
    }),
});

const { approveJoinRequest, denyJoinRequest, getPendingJoinRequests, requestToJoin } =
  joinRequestActions;

export {
  approveJoinRequest,
  createJoinRequestActions,
  denyJoinRequest,
  getPendingJoinRequests,
  requestToJoin,
};
