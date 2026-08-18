"use server";

import { prisma } from "@repo/db";

import { log } from "@/lib/observability";
import { requireAuth, requireTeamAdmin } from "@/lib/team-auth";

import { applyTeamContents, newTeamMember, readTeamRecord } from "../team-store";

import { createJoinRequestActions } from "./join-requests-core";

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

export { approveJoinRequest, denyJoinRequest, getPendingJoinRequests, requestToJoin };
