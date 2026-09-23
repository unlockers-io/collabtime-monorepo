import type { authenticate, authorizeTeamAdmin } from "@/lib/team-auth";

import { displayName } from "../display-name";
import type { SlotClaimResult } from "../team-slots";
import { UUIDSchema } from "../validation";

import type { ActionErrorEvent, ActionResult } from "./types";

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

type JoinRequestDeps = {
  approveMembership: (requestId: string, teamId: string, userId: string) => Promise<void>;
  authenticate: typeof authenticate;
  authorizeTeamAdmin: typeof authorizeTeamAdmin;
  denyRequest: (requestId: string) => Promise<void>;
  ensureMemberSlot: (teamId: string, userId: string, name: string) => Promise<SlotClaimResult>;
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
  notifyAdmins: (teamId: string, user: { email: string; name: string | null }) => void;
  notifyRequester: (request: JoinRequestRecord, decision: "approved" | "denied") => void;
  reportError: (event: ActionErrorEvent) => void;
  upsertRequest: (teamId: string, userId: string) => Promise<{ id: string }>;
};

const createJoinRequestActions = (deps: JoinRequestDeps) => {
  const requestToJoin = async (teamId: string): Promise<ActionResult<{ requestId: string }>> => {
    const auth = await deps.authenticate();
    if (!auth.success) {
      return auth;
    }
    const user = auth.data;
    try {
      const uuidResult = UUIDSchema.safeParse(teamId);
      if (!uuidResult.success) {
        return { error: "Invalid team ID", success: false };
      }

      const context = await deps.loadJoinContext(teamId, user.id);
      if (!context.teamExists) {
        return { error: "Team not found", success: false };
      }
      if (context.existingMembership) {
        return { error: "You are already a member of this team", success: false };
      }
      if (context.existingRequest?.status === "PENDING") {
        return { error: "You already have a pending request for this team", success: false };
      }

      const joinRequest = await deps.upsertRequest(teamId, user.id);
      deps.notifyAdmins(teamId, user);
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

  const findPendingRequest = async (
    teamId: string,
    requestId: string,
  ): Promise<ActionResult<JoinRequestRecord>> => {
    const joinRequest = await deps.findRequest(requestId);
    if (joinRequest?.teamId !== teamId) {
      return { error: "Join request not found", success: false };
    }
    if (joinRequest.status !== "PENDING") {
      return { error: "Join request is no longer pending", success: false };
    }
    return { data: joinRequest, success: true };
  };

  const approveJoinRequest = async (
    teamId: string,
    requestId: string,
  ): Promise<ActionResult<{ memberId: string }>> => {
    const access = await deps.authorizeTeamAdmin(teamId);
    if (!access.success) {
      return access;
    }
    try {
      const found = await findPendingRequest(teamId, requestId);
      if (!found.success) {
        return found;
      }
      const joinRequest = found.data;

      const memberName = displayName(joinRequest.user.name, joinRequest.user.email);
      const applied = await deps.ensureMemberSlot(
        joinRequest.teamId,
        joinRequest.userId,
        memberName,
      );
      if (!applied.ok) {
        return { error: applied.error, success: false };
      }
      await deps.approveMembership(requestId, joinRequest.teamId, joinRequest.userId);
      deps.notifyRequester(joinRequest, "approved");

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

  const denyJoinRequest = async (
    teamId: string,
    requestId: string,
  ): Promise<ActionResult<void>> => {
    const access = await deps.authorizeTeamAdmin(teamId);
    if (!access.success) {
      return access;
    }
    try {
      const found = await findPendingRequest(teamId, requestId);
      if (!found.success) {
        return found;
      }
      await deps.denyRequest(requestId);
      deps.notifyRequester(found.data, "denied");
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
    const access = await deps.authorizeTeamAdmin(teamId);
    if (!access.success) {
      return access;
    }
    try {
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

export { createJoinRequestActions };
