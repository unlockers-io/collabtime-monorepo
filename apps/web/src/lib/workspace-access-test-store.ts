import { vi } from "vitest";

import type { WorkspaceAccessStore } from "./workspace-access";

type StoredInvitation = NonNullable<Awaited<ReturnType<WorkspaceAccessStore["findInvitation"]>>>;
type StoredMembership = NonNullable<Awaited<ReturnType<WorkspaceAccessStore["findMembership"]>>>;

const viewerKey = (teamId: string, userId: string) => `${teamId}:${userId}`;

const createTestAccessStore = () => {
  const invitations: Array<StoredInvitation> = [];
  const joinRequests = new Map<string, string>();
  const memberships = new Map<string, StoredMembership>();
  const tokens = new Map<string, string>();

  const store = {
    findInvitation: vi.fn<WorkspaceAccessStore["findInvitation"]>((teamId, email) =>
      Promise.resolve(
        invitations.find(
          (invitation) => invitation.teamId === teamId && invitation.email === email,
        ) ?? null,
      ),
    ),
    findInvitationById: vi.fn<WorkspaceAccessStore["findInvitationById"]>((invitationId) =>
      Promise.resolve(invitations.find((invitation) => invitation.id === invitationId) ?? null),
    ),
    findJoinRequest: vi.fn<WorkspaceAccessStore["findJoinRequest"]>((teamId, userId) => {
      const status = joinRequests.get(viewerKey(teamId, userId));
      return Promise.resolve(status === undefined ? null : { status });
    }),
    findMembership: vi.fn<WorkspaceAccessStore["findMembership"]>((teamId, userId) =>
      Promise.resolve(memberships.get(viewerKey(teamId, userId)) ?? null),
    ),
    getToken: vi.fn<WorkspaceAccessStore["getToken"]>((spaceId) =>
      Promise.resolve(tokens.get(spaceId)),
    ),
  } satisfies WorkspaceAccessStore;

  return {
    addInvitation: (invitation: Partial<StoredInvitation> & Pick<StoredInvitation, "teamId">) => {
      invitations.push({
        email: "test@example.com",
        expiresAt: null,
        id: "cmf12345678901234567890123",
        invitedBy: { email: "owner@example.com", name: "Owner" },
        status: "PENDING",
        ...invitation,
      });
    },
    addJoinRequest: (teamId: string, userId: string, status = "PENDING") => {
      joinRequests.set(viewerKey(teamId, userId), status);
    },
    addMembership: (teamId: string, userId: string, membership?: Partial<StoredMembership>) => {
      memberships.set(viewerKey(teamId, userId), {
        archivedAt: null,
        role: "MEMBER",
        ...membership,
      });
    },
    removeMembership: (teamId: string, userId: string) => {
      memberships.delete(viewerKey(teamId, userId));
    },
    setToken: (spaceId: string, token: string) => {
      tokens.set(spaceId, token);
    },
    store,
  };
};

export { createTestAccessStore };
