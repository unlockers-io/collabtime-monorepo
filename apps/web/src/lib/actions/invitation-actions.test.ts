import { describe, expect, it } from "vitest";

import { INVITATION_EXPIRED_ERROR } from "../invitations";

import { invitation, INVITATION_ID, NOW, setupInvitations } from "./invitation-test-helpers";
import { createMockSession, VALID_UUID, VALID_UUID_2 } from "./test-helpers";

describe("inviting and managing invitations", () => {
  it("normalizes email and stores expiry before awaiting delivery", async () => {
    const { deps, inviteMember } = setupInvitations();
    expect(await inviteMember(VALID_UUID, VALID_UUID_2, " TEST@Example.com ")).toMatchObject({
      success: true,
    });
    expect(deps.upsertInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        expiresAt: new Date("2026-09-24T12:00:00Z"),
      }),
    );
    expect(deps.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        teamUrl: expect.stringContaining(`?invite=${INVITATION_ID}`),
        type: "invitation",
      }),
    );
    expect(deps.checkRateLimit.mock.calls).toEqual([
      ["invite:user:user-123", 50, 3600],
      [`invite:team:${VALID_UUID}`, 200, 86_400],
    ]);
  });
  it("requires an administrator before validating, creating or sending", async () => {
    const { deps, inviteMember } = setupInvitations();
    deps.authorizeTeamAdmin.mockResolvedValue({ error: "Admin access required", success: false });
    expect(await inviteMember(VALID_UUID, "not-a-uuid", "not-an-email")).toEqual({
      error: "Admin access required",
      success: false,
    });
    expect(deps.authorizeTeamAdmin).toHaveBeenCalledWith(VALID_UUID);
    expect(deps.loadInviteContext).not.toHaveBeenCalled();
    expect(deps.upsertInvitation).not.toHaveBeenCalled();
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });
  it("does not send or store after rate limiting", async () => {
    const { deps, inviteMember } = setupInvitations();
    deps.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    expect(await inviteMember(VALID_UUID, VALID_UUID_2, invitation.email)).toEqual({
      error: "Too many invitations. Try again later.",
      success: false,
    });
    expect(deps.upsertInvitation).not.toHaveBeenCalled();
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });
  it("does not send when configured rate-limit storage fails", async () => {
    const { deps, inviteMember } = setupInvitations();
    deps.checkRateLimit.mockRejectedValue(new Error("Redis unavailable"));
    expect(await inviteMember(VALID_UUID, VALID_UUID_2, invitation.email)).toMatchObject({
      success: false,
    });
    expect(deps.upsertInvitation).not.toHaveBeenCalled();
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });
  it("keeps created invitations when mail is not delivered", async () => {
    const { deps, inviteMember } = setupInvitations();
    deps.sendEmail.mockResolvedValue({ sent: false });
    expect(await inviteMember(VALID_UUID, VALID_UUID_2, invitation.email)).toEqual({
      data: { emailSent: false, invitationId: INVITATION_ID },
      success: true,
    });
  });
  it("shows expired pending invitations to admins and renews them", async () => {
    const { deps, getPendingTeamInvitations, resendInvitation } = setupInvitations();
    const expired = { ...invitation, expiresAt: NOW };
    deps.listPendingForTeam.mockResolvedValue([expired]);
    deps.findInvitation.mockResolvedValue(expired);
    expect(await getPendingTeamInvitations(VALID_UUID)).toMatchObject({
      data: [{ expiresAt: NOW.toISOString(), id: INVITATION_ID }],
      success: true,
    });
    expect(await resendInvitation(VALID_UUID, INVITATION_ID)).toMatchObject({ success: true });
    expect(deps.refreshExpiry).toHaveBeenCalledWith(expired, new Date("2026-09-24T12:00:00Z"));
    expect(deps.checkRateLimit).toHaveBeenCalledTimes(2);
  });
  it("does not refresh expiry or send when resend is rate limited", async () => {
    const { deps, resendInvitation } = setupInvitations();
    deps.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    expect(await resendInvitation(VALID_UUID, INVITATION_ID)).toMatchObject({ success: false });
    expect(deps.refreshExpiry).not.toHaveBeenCalled();
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });
  it("requires an admin for list, revoke and resend before any lookup", async () => {
    const { deps, getPendingTeamInvitations, resendInvitation, revokeInvitation } =
      setupInvitations();
    const denied = { error: "Admin access required", success: false };
    deps.authorizeTeamAdmin.mockResolvedValue({ error: "Admin access required", success: false });
    expect(await getPendingTeamInvitations(VALID_UUID)).toEqual(denied);
    expect(await resendInvitation(VALID_UUID, INVITATION_ID)).toEqual(denied);
    expect(await revokeInvitation(VALID_UUID, INVITATION_ID)).toEqual(denied);
    expect(deps.listPendingForTeam).not.toHaveBeenCalled();
    expect(deps.findInvitation).not.toHaveBeenCalled();
    expect(deps.markRevoked).not.toHaveBeenCalled();
    expect(deps.refreshExpiry).not.toHaveBeenCalled();
  });
  it("treats another team's invitation as missing", async () => {
    const { deps, resendInvitation, revokeInvitation } = setupInvitations();
    const missing = { error: "Invitation not found", success: false };
    expect(await resendInvitation(VALID_UUID_2, INVITATION_ID)).toEqual(missing);
    expect(await revokeInvitation(VALID_UUID_2, INVITATION_ID)).toEqual(missing);
    expect(deps.authorizeTeamAdmin).toHaveBeenCalledWith(VALID_UUID_2);
    expect(deps.markRevoked).not.toHaveBeenCalled();
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });
  it("revokes without sending email", async () => {
    const { deps, revokeInvitation } = setupInvitations();
    expect(await revokeInvitation(VALID_UUID, INVITATION_ID)).toMatchObject({ success: true });
    expect(deps.markRevoked).toHaveBeenCalledWith(invitation);
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });
});

describe("invitation decisions", () => {
  it("requires a session before looking the invitation up", async () => {
    const { acceptInvitation, declineInvitation, deps } = setupInvitations();
    const denied = { error: "Authentication required", success: false };
    deps.authenticate.mockResolvedValue({ error: "Authentication required", success: false });
    expect(await acceptInvitation(INVITATION_ID)).toEqual(denied);
    expect(await declineInvitation(INVITATION_ID)).toEqual(denied);
    expect(deps.findInvitation).not.toHaveBeenCalled();
  });
  it("accepts case-insensitive addresses and commits the actual slot before notifying", async () => {
    const { acceptInvitation, deps } = setupInvitations();
    deps.authenticate.mockResolvedValue({
      data: createMockSession({ email: " TEST@EXAMPLE.COM " }).user,
      success: true,
    });
    deps.claimOrCreateSlot.mockResolvedValue({ created: true, memberId: "replacement", ok: true });
    expect(await acceptInvitation(INVITATION_ID)).toMatchObject({ success: true });
    expect(deps.commitAcceptance).toHaveBeenCalledWith(invitation, "replacement", "user-123");
    expect(deps.claimOrCreateSlot).toHaveBeenCalledBefore(deps.commitAcceptance);
    expect(deps.notifyInviter).toHaveBeenCalledWith(
      invitation,
      expect.objectContaining({ id: "user-123" }),
      "accepted",
    );
  });
  it("does not commit membership when the slot write fails", async () => {
    const { acceptInvitation, deps } = setupInvitations();
    deps.claimOrCreateSlot.mockResolvedValue({
      error: "Failed to save the team",
      ok: false,
      reason: "write-failed",
    });
    expect(await acceptInvitation(INVITATION_ID)).toMatchObject({ success: false });
    expect(deps.commitAcceptance).not.toHaveBeenCalled();
    expect(deps.notifyInviter).not.toHaveBeenCalled();
  });
  it("can retry after a database failure with the same profile slot", async () => {
    const { acceptInvitation, deps } = setupInvitations();
    deps.commitAcceptance.mockRejectedValueOnce(new Error("Database unavailable"));
    expect(await acceptInvitation(INVITATION_ID)).toMatchObject({ success: false });
    expect(await acceptInvitation(INVITATION_ID)).toMatchObject({ success: true });
    expect(deps.commitAcceptance).toHaveBeenNthCalledWith(2, invitation, VALID_UUID_2, "user-123");
    expect(deps.notifyInviter).toHaveBeenCalledTimes(1);
  });
  it.each(["ACCEPTED", "DECLINED", "REVOKED"])("rejects %s invitations", async (status) => {
    const { acceptInvitation, declineInvitation, deps } = setupInvitations();
    deps.findInvitation.mockResolvedValue({ ...invitation, status });
    expect(await acceptInvitation(INVITATION_ID)).toMatchObject({ success: false });
    expect(await declineInvitation(INVITATION_ID)).toMatchObject({ success: false });
    expect(deps.claimOrCreateSlot).not.toHaveBeenCalled();
    expect(deps.markDeclined).not.toHaveBeenCalled();
  });
  it("rejects an expiry exactly at now", async () => {
    const { acceptInvitation, declineInvitation, deps } = setupInvitations();
    deps.findInvitation.mockResolvedValue({ ...invitation, expiresAt: NOW });
    expect(await acceptInvitation(INVITATION_ID)).toEqual({
      error: INVITATION_EXPIRED_ERROR,
      success: false,
    });
    expect(await declineInvitation(INVITATION_ID)).toEqual({
      error: INVITATION_EXPIRED_ERROR,
      success: false,
    });
  });
  it("rejects a different email before claiming any slot", async () => {
    const { acceptInvitation, deps } = setupInvitations();
    deps.authenticate.mockResolvedValue({
      data: createMockSession({ email: "someone@example.com" }).user,
      success: true,
    });
    expect(await acceptInvitation(INVITATION_ID)).toEqual({
      error: "This invitation is not for you",
      success: false,
    });
    expect(deps.claimOrCreateSlot).not.toHaveBeenCalled();
  });
  it("accepts legacy invitations without an expiry", async () => {
    const { acceptInvitation, deps } = setupInvitations();
    deps.findInvitation.mockResolvedValue({ ...invitation, expiresAt: null });
    expect(await acceptInvitation(INVITATION_ID)).toMatchObject({ success: true });
  });
  it("declines and notifies without changing slots or memberships", async () => {
    const { declineInvitation, deps } = setupInvitations();
    expect(await declineInvitation(INVITATION_ID)).toMatchObject({ success: true });
    expect(deps.markDeclined).toHaveBeenCalledWith(invitation);
    expect(deps.notifyInviter).toHaveBeenCalledWith(
      invitation,
      expect.objectContaining({ id: "user-123" }),
      "declined",
    );
    expect(deps.claimOrCreateSlot).not.toHaveBeenCalled();
    expect(deps.commitAcceptance).not.toHaveBeenCalled();
  });
});
