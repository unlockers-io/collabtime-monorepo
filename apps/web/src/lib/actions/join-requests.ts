"use server";

import { after } from "next/server";

import { getPrisma } from "@/lib/db";
import { log } from "@/lib/observability";
import { authenticate, authorizeTeamAdmin } from "@/lib/team-auth";

import { grantMembership } from "../membership";
import { teamNotifier } from "../team-notifications";
import { readTeamRecord } from "../team-store";

import { createJoinRequestActions } from "./join-requests-core";

const joinRequestActions = createJoinRequestActions({
  approveRequest: async (requestId, transaction) => {
    await transaction.joinRequest.update({
      data: { status: "APPROVED" },
      where: { id: requestId, status: "PENDING" },
    });
  },
  authenticate,
  authorizeTeamAdmin,
  denyRequest: async (requestId) => {
    await getPrisma().joinRequest.update({
      data: { status: "DENIED" },
      where: { id: requestId, status: "PENDING" },
    });
  },
  findRequest: (requestId) =>
    getPrisma().joinRequest.findUnique({
      include: { user: true },
      where: { id: requestId, status: "PENDING" },
    }),
  grantMembership,
  listPending: async (teamId) => {
    const [requests, memberships] = await Promise.all([
      getPrisma().joinRequest.findMany({
        include: { user: { select: { email: true, id: true, name: true } } },
        orderBy: { createdAt: "asc" },
        where: { status: "PENDING", teamId },
      }),
      getPrisma().membership.findMany({ select: { userId: true }, where: { teamId } }),
    ]);

    return { memberUserIds: memberships.map((membership) => membership.userId), requests };
  },
  loadJoinContext: async (teamId, userId) => {
    const [team, existingMembership, existingRequest] = await Promise.all([
      readTeamRecord(teamId),
      getPrisma().membership.findUnique({ where: { userId_teamId: { teamId, userId } } }),
      getPrisma().joinRequest.findUnique({ where: { userId_teamId: { teamId, userId } } }),
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
    getPrisma().joinRequest.upsert({
      create: { status: "PENDING", teamId, userId },
      update: { status: "PENDING" },
      where: { userId_teamId: { teamId, userId } },
    }),
});

const { approveJoinRequest, denyJoinRequest, getPendingJoinRequests, requestToJoin } =
  joinRequestActions;

export { approveJoinRequest, denyJoinRequest, getPendingJoinRequests, requestToJoin };
