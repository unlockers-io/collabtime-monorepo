import { vi } from "vitest";

import { createInvitationActions } from "./invitation-actions-core";
import type { InvitationDeps, InvitationRecord } from "./invitation-deps";
import { createInvitationManagementActions } from "./invitation-management-core";
import {
  createTestGuards,
  createTestMember,
  createTestTeamRecord,
  VALID_UUID,
  VALID_UUID_2,
} from "./test-helpers";

export const NOW = new Date("2026-09-10T12:00:00Z");
export const INVITATION_ID = "cmf12345678901234567890123";
export const invitation: InvitationRecord = {
  createdAt: NOW,
  email: "test@example.com",
  expiresAt: new Date("2026-09-24T12:00:00Z"),
  id: INVITATION_ID,
  invitedBy: { email: "owner@example.com", name: "Owner" },
  memberId: VALID_UUID_2,
  status: "PENDING",
  teamId: VALID_UUID,
  updatedAt: NOW,
};
export const setupInvitations = () => {
  const guards = createTestGuards();
  const deps = {
    authenticate: guards.authenticate,
    authorizeTeamAdmin: guards.authorizeTeamAdmin,
    checkRateLimit: vi
      .fn<InvitationDeps["checkRateLimit"]>()
      .mockResolvedValue({ allowed: true, remaining: 49 }),
    claimOrCreateSlot: vi
      .fn<InvitationDeps["claimOrCreateSlot"]>()
      .mockResolvedValue({ created: false, memberId: VALID_UUID_2, ok: true }),
    commitAcceptance: vi.fn<InvitationDeps["commitAcceptance"]>().mockResolvedValue(),
    findInvitation: vi.fn<InvitationDeps["findInvitation"]>().mockResolvedValue(invitation),
    inviteLink: (teamId: string, id: string) => `https://app.example.com/${teamId}?invite=${id}`,
    listPendingForTeam: vi
      .fn<InvitationDeps["listPendingForTeam"]>()
      .mockResolvedValue([invitation]),
    loadInviteContext: vi.fn<InvitationDeps["loadInviteContext"]>().mockResolvedValue({
      existingMembership: false,
      team: createTestTeamRecord({ members: [createTestMember({ id: VALID_UUID_2 })] }),
    }),
    markDeclined: vi.fn<InvitationDeps["markDeclined"]>().mockResolvedValue(),
    markRevoked: vi.fn<InvitationDeps["markRevoked"]>().mockResolvedValue(),
    notifyInviter: vi.fn<InvitationDeps["notifyInviter"]>(),
    now: () => NOW,
    refreshExpiry: vi.fn<InvitationDeps["refreshExpiry"]>().mockResolvedValue(),
    reportError: vi.fn<InvitationDeps["reportError"]>(),
    sendEmail: vi.fn<InvitationDeps["sendEmail"]>().mockResolvedValue({ sent: true }),
    upsertInvitation: vi.fn<InvitationDeps["upsertInvitation"]>().mockResolvedValue(invitation),
  } satisfies InvitationDeps;
  return { ...createInvitationActions(deps), ...createInvitationManagementActions(deps), deps };
};
