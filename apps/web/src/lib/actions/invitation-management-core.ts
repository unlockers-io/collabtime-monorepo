import type { PendingTeamInvitation } from "@/types";

import { displayName } from "../display-name";
import { invitationExpiryFrom } from "../invitations";
import type { TeamAccess } from "../team-auth";
import { CuidSchema } from "../validation";

import type { InvitationDeps } from "./invitation-deps";
import { allowInvitationSend, INVITATION_RATE_ERROR } from "./invitation-guards";
import type { ActionResult } from "./types";

export const createInvitationManagementActions = (deps: InvitationDeps) => {
  const getPendingTeamInvitations = async (
    teamId: string,
  ): Promise<ActionResult<Array<PendingTeamInvitation>>> => {
    const access = await deps.authorizeTeamAdmin(teamId);
    if (!access.success) {
      return access;
    }
    try {
      const invitations = await deps.listPendingForTeam(teamId);
      return {
        data: invitations.map(({ createdAt, email, expiresAt, id, memberId }) => ({
          createdAt: createdAt.toISOString(),
          email,
          expiresAt: expiresAt?.toISOString() ?? null,
          id,
          memberId,
        })),
        success: true,
      };
    } catch (error) {
      deps.reportError({
        error,
        message: "Failed to list invitations",
        route: "actions/invitation",
      });
      return { error: "Failed to get invitations", success: false };
    }
  };
  const manageInvitation = async (
    { teamId, user }: TeamAccess,
    id: string,
    action: "resend" | "revoke",
  ): Promise<ActionResult<{ emailSent: boolean }>> => {
    try {
      if (!CuidSchema.safeParse(id).success) {
        return { error: "Invalid invitation ID", success: false };
      }
      const invitation = await deps.findInvitation(id);
      if (invitation?.teamId !== teamId) {
        return { error: "Invitation not found", success: false };
      }
      if (invitation.status !== "PENDING") {
        return { error: "This invitation is no longer pending", success: false };
      }
      if (action === "revoke") {
        await deps.markRevoked(invitation);
        return { data: { emailSent: false }, success: true };
      }
      const { team } = await deps.loadInviteContext(teamId, invitation.email);
      if (!team) {
        return { error: "Team not found", success: false };
      }
      if (!(await allowInvitationSend(deps, user.id, teamId))) {
        return { error: INVITATION_RATE_ERROR, success: false };
      }
      const expiresAt = invitationExpiryFrom(deps.now());
      await deps.refreshExpiry(invitation, expiresAt);
      const { sent } = await deps.sendEmail({
        expiresAt: expiresAt.toISOString(),
        inviterName: displayName(invitation.invitedBy.name, invitation.invitedBy.email),
        recipientEmail: invitation.email,
        teamId,
        teamName: team.name,
        teamUrl: deps.inviteLink(teamId, id),
        type: "invitation",
      });
      return { data: { emailSent: sent }, success: true };
    } catch (error) {
      deps.reportError({
        error,
        invitationId: id,
        message: "Failed to manage invitation",
        route: "actions/invitation",
      });
      return { error: "Could not update this invitation. Refresh and try again.", success: false };
    }
  };
  const resendInvitation = async (
    teamId: string,
    id: string,
  ): Promise<ActionResult<{ emailSent: boolean }>> => {
    const access = await deps.authorizeTeamAdmin(teamId);
    if (!access.success) {
      return access;
    }
    const result = await manageInvitation(access.data, id, "resend");
    return result;
  };
  const revokeInvitation = async (teamId: string, id: string): Promise<ActionResult<void>> => {
    const access = await deps.authorizeTeamAdmin(teamId);
    if (!access.success) {
      return access;
    }
    const result = await manageInvitation(access.data, id, "revoke");
    return result.success ? { data: undefined, success: true } : result;
  };
  return { getPendingTeamInvitations, resendInvitation, revokeInvitation };
};
