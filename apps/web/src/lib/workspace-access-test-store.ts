import { type InvitationStatus, type JoinRequestStatus, prisma } from "@repo/db";
import { vi } from "vitest";

import type { TeamRole } from "@/types";

import { TEST_OWNER_ID } from "./actions/test-helpers";
import { createTeamAuth, findTeamMembership } from "./team-auth";
import { type ViewerDeps, viewerDeps as postgresViewerDeps } from "./team-viewer";

type TeamAuthDeps = Parameters<typeof createTeamAuth>[0];

type Session = Awaited<ReturnType<TeamAuthDeps["getSession"]>>;

type InvitationSeed = {
  email?: string;
  expiresAt?: Date | null;
  id?: string;
  status?: InvitationStatus;
  teamId: string;
};

/** Team access over the test database; only the cookie jar and the session are stand-ins. */
const createTestAccessStore = () => {
  const tokens = new Map<string, string>();
  let session: Session = null;

  const store = {
    findJoinRequest: vi.fn(postgresViewerDeps.findJoinRequest),
    findMembership: vi.fn(findTeamMembership),
    invitations: {
      find: vi.fn(postgresViewerDeps.invitations.find),
      listOpenForEmail: vi.fn(postgresViewerDeps.invitations.listOpenForEmail),
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
    addInvitation: async (invitation: InvitationSeed) => {
      await prisma.invitation.create({
        data: {
          email: "test@example.com",
          id: "cmf12345678901234567890123",
          invitedById: TEST_OWNER_ID,
          memberId: "member-1",
          ...invitation,
        },
      });
    },
    addJoinRequest: async (
      teamId: string,
      userId: string,
      status: JoinRequestStatus = "PENDING",
    ) => {
      await prisma.joinRequest.upsert({
        create: { status, teamId, userId },
        update: { status },
        where: { userId_teamId: { teamId, userId } },
      });
    },
    addMembership: async (
      teamId: string,
      userId: string,
      membership: { archivedAt?: Date | null; role?: TeamRole } = {},
    ) => {
      await prisma.membership.upsert({
        create: { ...membership, teamId, userId },
        update: membership,
        where: { userId_teamId: { teamId, userId } },
      });
    },
    auth,
    removeMembership: async (teamId: string, userId: string) => {
      await prisma.membership.delete({ where: { userId_teamId: { teamId, userId } } });
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
