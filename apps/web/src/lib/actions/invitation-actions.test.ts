import { describe, expect, it } from "vitest";

import { INVITATION_EXPIRED_ERROR } from "../invitations";

import {
  invitation,
  INVITATION_ID,
  invitedTeam,
  NOW,
  setupInvitations,
} from "./invitation-test-helpers";
import {
  createMockSession,
  createTestMember,
  createTestTeamRecord,
  VALID_UUID,
  VALID_UUID_2,
} from "./test-helpers";

describe("inviting and managing invitations", () => {
  it("normalizes email and stores expiry before awaiting delivery", async () => {
    const { deps, inviteMember } = await setupInvitations();
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
    const { deps, inviteMember } = await setupInvitations();
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
    const { deps, inviteMember } = await setupInvitations();
    deps.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    expect(await inviteMember(VALID_UUID, VALID_UUID_2, invitation.email)).toEqual({
      error: "Too many invitations. Try again later.",
      success: false,
    });
    expect(deps.upsertInvitation).not.toHaveBeenCalled();
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });
  it("does not send when configured rate-limit storage fails", async () => {
    const { deps, inviteMember } = await setupInvitations();
    deps.checkRateLimit.mockRejectedValue(new Error("Redis unavailable"));
    expect(await inviteMember(VALID_UUID, VALID_UUID_2, invitation.email)).toMatchObject({
      success: false,
    });
    expect(deps.upsertInvitation).not.toHaveBeenCalled();
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });
  it("keeps created invitations when mail is not delivered", async () => {
    const { deps, inviteMember } = await setupInvitations();
    deps.sendEmail.mockResolvedValue({ sent: false });
    expect(await inviteMember(VALID_UUID, VALID_UUID_2, invitation.email)).toEqual({
      data: { emailSent: false, invitationId: INVITATION_ID },
      success: true,
    });
  });
  it("shows expired pending invitations to admins and renews them", async () => {
    const { deps, getPendingTeamInvitations, resendInvitation } = await setupInvitations();
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
    const { deps, resendInvitation } = await setupInvitations();
    deps.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    expect(await resendInvitation(VALID_UUID, INVITATION_ID)).toMatchObject({ success: false });
    expect(deps.refreshExpiry).not.toHaveBeenCalled();
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });
  it("requires an admin for list, revoke and resend before any lookup", async () => {
    const { deps, getPendingTeamInvitations, resendInvitation, revokeInvitation } =
      await setupInvitations();
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
    const { deps, resendInvitation, revokeInvitation } = await setupInvitations();
    const missing = { error: "Invitation not found", success: false };
    expect(await resendInvitation(VALID_UUID_2, INVITATION_ID)).toEqual(missing);
    expect(await revokeInvitation(VALID_UUID_2, INVITATION_ID)).toEqual(missing);
    expect(deps.authorizeTeamAdmin).toHaveBeenCalledWith(VALID_UUID_2);
    expect(deps.markRevoked).not.toHaveBeenCalled();
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });
  it("revokes without sending email", async () => {
    const { deps, revokeInvitation } = await setupInvitations();
    expect(await revokeInvitation(VALID_UUID, INVITATION_ID)).toMatchObject({ success: true });
    expect(deps.markRevoked).toHaveBeenCalledWith(invitation);
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });
});

const invitedSlot = async (harness: Awaited<ReturnType<typeof setupInvitations>>["harness"]) => {
  const team = await harness.readTeam();
  return team?.members.find((member) => member.id === VALID_UUID_2);
};

describe("invitation decisions", () => {
  it("requires a session before looking the invitation up", async () => {
    const { acceptInvitation, declineInvitation, deps } = await setupInvitations();
    const denied = { error: "Authentication required", success: false };
    deps.authenticate.mockResolvedValue({ error: "Authentication required", success: false });
    expect(await acceptInvitation(INVITATION_ID)).toEqual(denied);
    expect(await declineInvitation(INVITATION_ID)).toEqual(denied);
    expect(deps.findInvitation).not.toHaveBeenCalled();
  });
  it("accepts case-insensitive addresses into the invited slot before notifying", async () => {
    const { acceptInvitation, deps, harness } = await setupInvitations();
    deps.authenticate.mockResolvedValue({
      data: createMockSession({ email: " TEST@EXAMPLE.COM " }).user,
      success: true,
    });
    expect(await acceptInvitation(INVITATION_ID)).toEqual({
      data: { teamId: VALID_UUID },
      success: true,
    });
    expect(await invitedSlot(harness)).toMatchObject({ userId: "user-123" });
    expect(harness.findMembership("user-123")).toEqual({ archivedAt: null, role: "MEMBER" });
    expect(deps.commitAcceptance).toHaveBeenCalledWith(
      invitation,
      { role: "MEMBER", teamId: VALID_UUID, userId: "user-123" },
      VALID_UUID_2,
    );
    expect(deps.notifyInviter).toHaveBeenCalledWith(
      invitation,
      expect.objectContaining({ id: "user-123" }),
      "accepted",
    );
  });
  it("records a replacement slot when the invited one was taken", async () => {
    const { acceptInvitation, deps } = await setupInvitations(
      createTestTeamRecord({ members: [createTestMember({ id: VALID_UUID_2, userId: "x" })] }),
    );
    expect(await acceptInvitation(INVITATION_ID)).toMatchObject({ success: true });
    expect(deps.commitAcceptance).toHaveBeenCalledWith(
      invitation,
      expect.objectContaining({ userId: "user-123" }),
      "test-uuid",
    );
  });
  it("grants no membership when the slot cannot be claimed", async () => {
    const { acceptInvitation, deps, harness } = await setupInvitations(null);
    expect(await acceptInvitation(INVITATION_ID)).toEqual({
      error: "Team not found",
      success: false,
    });
    expect(deps.commitAcceptance).not.toHaveBeenCalled();
    expect(harness.findMembership("user-123")).toBeNull();
    expect(deps.notifyInviter).not.toHaveBeenCalled();
  });
  it("hands the slot back after a database failure so a retry claims it again", async () => {
    const { acceptInvitation, deps, harness } = await setupInvitations();
    deps.commitAcceptance.mockRejectedValueOnce(new Error("Database unavailable"));
    expect(await acceptInvitation(INVITATION_ID)).toEqual({
      error: "Could not update this invitation. Refresh and try again.",
      success: false,
    });
    expect(await invitedSlot(harness)).toEqual(createTestMember({ id: VALID_UUID_2 }));
    expect(harness.findMembership("user-123")).toBeNull();

    expect(await acceptInvitation(INVITATION_ID)).toMatchObject({ success: true });
    expect(deps.commitAcceptance).toHaveBeenLastCalledWith(
      invitation,
      expect.objectContaining({ userId: "user-123" }),
      VALID_UUID_2,
    );
    expect(deps.notifyInviter).toHaveBeenCalledTimes(1);
  });
  it.each(["ACCEPTED", "DECLINED", "REVOKED"])("rejects %s invitations", async (status) => {
    const { acceptInvitation, declineInvitation, deps, harness } = await setupInvitations();
    deps.findInvitation.mockResolvedValue({ ...invitation, status });
    expect(await acceptInvitation(INVITATION_ID)).toMatchObject({ success: false });
    expect(await declineInvitation(INVITATION_ID)).toMatchObject({ success: false });
    expect(await harness.readTeam()).toEqual(invitedTeam);
    expect(deps.markDeclined).not.toHaveBeenCalled();
  });
  it("rejects an expiry exactly at now", async () => {
    const { acceptInvitation, declineInvitation, deps } = await setupInvitations();
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
    const { acceptInvitation, deps, harness } = await setupInvitations();
    deps.authenticate.mockResolvedValue({
      data: createMockSession({ email: "someone@example.com" }).user,
      success: true,
    });
    expect(await acceptInvitation(INVITATION_ID)).toEqual({
      error: "This invitation is not for you",
      success: false,
    });
    expect(await harness.readTeam()).toEqual(invitedTeam);
  });
  it("accepts legacy invitations without an expiry", async () => {
    const { acceptInvitation, deps } = await setupInvitations();
    deps.findInvitation.mockResolvedValue({ ...invitation, expiresAt: null });
    expect(await acceptInvitation(INVITATION_ID)).toMatchObject({ success: true });
  });
  it("declines and notifies without changing slots or memberships", async () => {
    const { declineInvitation, deps, harness } = await setupInvitations();
    expect(await declineInvitation(INVITATION_ID)).toMatchObject({ success: true });
    expect(deps.markDeclined).toHaveBeenCalledWith(invitation);
    expect(deps.notifyInviter).toHaveBeenCalledWith(
      invitation,
      expect.objectContaining({ id: "user-123" }),
      "declined",
    );
    expect(await harness.readTeam()).toEqual(invitedTeam);
    expect(harness.findMembership("user-123")).toBeNull();
  });
});
