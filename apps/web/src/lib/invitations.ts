import { INVITATION_TTL_DAYS } from "./limits";

type InvitationState = { expiresAt: Date | null; status: string };
export const INVITATION_EXPIRED_ERROR =
  "This invitation has expired. Ask a workspace admin to resend it.";
export const isInvitationExpired = (invitation: InvitationState, now: Date): boolean =>
  invitation.expiresAt !== null && invitation.expiresAt <= now;
export const isInvitationOpen = (invitation: InvitationState, now: Date): boolean =>
  invitation.status === "PENDING" && !isInvitationExpired(invitation, now);
export const invitationExpiryFrom = (now: Date): Date =>
  new Date(now.getTime() + INVITATION_TTL_DAYS * 86_400_000);
export const openInvitationWhere = (now: Date) => ({
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  status: "PENDING" as const,
});
export const maskEmail = (email: string): string => {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
};
export const inviteLink = (appUrl: string, teamId: string, invitationId: string): string => {
  const url = new URL(`/${teamId}`, appUrl);
  url.searchParams.set("invite", invitationId);
  return url.toString();
};
