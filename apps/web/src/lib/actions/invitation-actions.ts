"use server";

import type { PendingTeamInvitation } from "@/types";

import { invitations } from "../invitations";
import { authenticate, authorizeTeamAdmin } from "../team-auth";

import type { ActionResult } from "./types";

const inviteMember = async (
  teamId: string,
  memberId: string,
  email: string,
): Promise<ActionResult<{ emailSent: boolean; invitationId: string }>> => {
  const access = await authorizeTeamAdmin(teamId);
  return access.success ? invitations.invite(access.data, { email, memberId }) : access;
};

const getPendingTeamInvitations = async (
  teamId: string,
): Promise<ActionResult<Array<PendingTeamInvitation>>> => {
  const access = await authorizeTeamAdmin(teamId);
  return access.success ? invitations.listForTeam(access.data) : access;
};

const resendInvitation = async (
  teamId: string,
  id: string,
): Promise<ActionResult<{ emailSent: boolean }>> => {
  const access = await authorizeTeamAdmin(teamId);
  return access.success ? invitations.resend(access.data, id) : access;
};

const revokeInvitation = async (teamId: string, id: string): Promise<ActionResult<void>> => {
  const access = await authorizeTeamAdmin(teamId);
  return access.success ? invitations.revoke(access.data, id) : access;
};

const acceptInvitation = async (
  invitationId: string,
): Promise<ActionResult<{ teamId: string }>> => {
  const auth = await authenticate();
  return auth.success ? invitations.accept(auth.data, invitationId) : auth;
};

const declineInvitation = async (invitationId: string): Promise<ActionResult<void>> => {
  const auth = await authenticate();
  return auth.success ? invitations.decline(auth.data, invitationId) : auth;
};

export {
  acceptInvitation,
  declineInvitation,
  getPendingTeamInvitations,
  inviteMember,
  resendInvitation,
  revokeInvitation,
};
