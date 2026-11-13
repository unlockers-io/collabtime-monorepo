import { vi } from "vitest";

import { createMemoryInvitationStore } from "./invitation-memory-store";
import type { StoredInvitation } from "./invitations";
import { createTeamAuth } from "./team-auth";
import type { ViewerDeps } from "./team-viewer";

type TeamAuthDeps = Parameters<typeof createTeamAuth>[0];

type StoredMembership = NonNullable<Awaited<ReturnType<TeamAuthDeps["findMembership"]>>>;

type Session = Awaited<ReturnType<TeamAuthDeps["getSession"]>>;

const viewerKey = (teamId: string, userId: string) => `${teamId}:${userId}`;

const createTestAccessStore = () => {
  const invitations = createMemoryInvitationStore();
  const joinRequests = new Map<string, string>();
  const memberships = new Map<string, StoredMembership>();
  const tokens = new Map<string, string>();
  let session: Session = null;

  const store = {
    findJoinRequest: vi.fn<ViewerDeps["findJoinRequest"]>((teamId, userId) => {
      const status = joinRequests.get(viewerKey(teamId, userId));

      return Promise.resolve(status === undefined ? null : { status });
    }),
    findMembership: vi.fn<TeamAuthDeps["findMembership"]>((teamId, userId) =>
      Promise.resolve(memberships.get(viewerKey(teamId, userId)) ?? null),
    ),
    invitations: {
      find: vi.fn(invitations.find),
      listOpenForEmail: vi.fn(invitations.listOpenForEmail),
    },
    readAccessToken: vi.fn<TeamAuthDeps["readAccessToken"]>((spaceId) =>
      Promise.resolve(tokens.get(spaceId)),
    ),
  };

  const auth = createTeamAuth({
    findMembership: store.findMembership,
    getSession: () => Promise.resolve(session),
    readAccessToken: store.readAccessToken,
    reportError: vi.fn<TeamAuthDeps["reportError"]>(),
  });

  const viewerDeps: ViewerDeps = {
    findJoinRequest: store.findJoinRequest,
    invitations: store.invitations,
    readTeamAccess: auth.readTeamAccess,
  };

  return {
    addInvitation: (invitation: Partial<StoredInvitation> & Pick<StoredInvitation, "teamId">) => {
      invitations.seed({
        createdAt: new Date(0),
        email: "test@example.com",
        expiresAt: null,
        id: "cmf12345678901234567890123",
        invitedBy: { email: "owner@example.com", name: "Owner" },
        memberId: "member-1",
        status: "PENDING",
        updatedAt: new Date(0),
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
    auth,
    removeMembership: (teamId: string, userId: string) => {
      memberships.delete(viewerKey(teamId, userId));
    },
    setToken: (spaceId: string, token: string) => {
      tokens.set(spaceId, token);
    },
    signIn: (next: Session) => {
      session = next;
    },
    store,
    viewerDeps,
  };
};

export { createTestAccessStore };
