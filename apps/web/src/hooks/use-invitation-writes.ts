"use client";

import { inviteMember, resendInvitation, revokeInvitation } from "@/lib/actions/invitation-actions";

import { useTeamWrite } from "./use-team-write";

const useInvitationWrites = (teamId: string) => {
  const write = useTeamWrite(teamId);

  return {
    invite: (memberId: string, email: string) =>
      write.run(() => inviteMember(teamId, memberId, email)),
    resend: (invitationId: string) => write.run(() => resendInvitation(teamId, invitationId)),
    revoke: (invitationId: string) => write.run(() => revokeInvitation(teamId, invitationId)),
  };
};

const invitationSentMessage = (email: string, emailSent: boolean): string =>
  emailSent
    ? `Invitation sent to ${email}`
    : `Invitation created for ${email} (email was not delivered)`;

export { invitationSentMessage, useInvitationWrites };
