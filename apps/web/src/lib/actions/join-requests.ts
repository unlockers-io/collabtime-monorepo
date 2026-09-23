"use server";

import { prisma } from "@repo/db";
import { after } from "next/server";

import { log } from "@/lib/observability";
import { authenticate, authorizeTeamAdmin } from "@/lib/team-auth";

import { teamNotifier } from "../team-notifier";
import { claimOrCreateMemberSlot } from "../team-slots";
import { readTeamRecord } from "../team-store";

import { createJoinRequestActions } from "./join-requests-core";

const joinRequestActions = createJoinRequestActions({
  approveMembership: async (requestId, teamId, userId) => {
    await prisma.$transaction([
      prisma.joinRequest.update({
        data: { status: "APPROVED" },
        where: { id: requestId, status: "PENDING" },
      }),
      prisma.membership.upsert({
        create: { role: "MEMBER", teamId, userId },
        update: { archivedAt: null },
        where: { userId_teamId: { teamId, userId } },
      }),
    ]);
  },
  authenticate,
  authorizeTeamAdmin,
  denyRequest: async (requestId) => {
    await prisma.joinRequest.update({
      data: { status: "DENIED" },
      where: { id: requestId, status: "PENDING" },
    });
  },
  ensureMemberSlot: (teamId, userId, name) => claimOrCreateMemberSlot(teamId, { name, userId }),
  findRequest: (requestId) =>
    prisma.joinRequest.findUnique({
      include: { user: true },
      where: { id: requestId, status: "PENDING" },
    }),
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
  notifyAdmins: (teamId, user) => {
    after(() => teamNotifier.notifyAdminsOfJoinRequest(teamId, user));
  },
  notifyRequester: (request, decision) => {
    after(() => teamNotifier.notifyRequesterOfDecision(request, decision));
  },
  reportError: log.error,
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
