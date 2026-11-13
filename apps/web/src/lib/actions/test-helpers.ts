import { prisma } from "@repo/db";
import { vi } from "vitest";

import type {
  authenticate,
  authorizeTeamAdmin,
  authorizeTeamMember,
  TeamAccess,
} from "@/lib/team-auth";
import type { TeamGroup, TeamMember, TeamRecord, TeamRole } from "@/types";

import { createMembershipLifecycle, prismaMembershipStore } from "../membership";
import { teamCommands } from "../team-commands";
import { postgresTeamStorage, type TeamStorage } from "../team-storage";
import { createTeamStore, type TeamStoreDeps } from "../team-store";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_UUID_2 = "660e8400-e29b-41d4-a716-446655440001";
const VALID_UUID_3 = "770e8400-e29b-41d4-a716-446655440002";

const createTestMember = (overrides?: Partial<TeamMember>): TeamMember => ({
  id: VALID_UUID,
  name: "Alice",
  order: 0,
  timezone: "America/New_York",
  title: "Engineer",
  workingHoursEnd: 17,
  workingHoursStart: 9,
  ...overrides,
});

const createTestGroup = (overrides?: Partial<TeamGroup>): TeamGroup => ({
  id: VALID_UUID_2,
  name: "Engineering",
  order: 0,
  ...overrides,
});

const createTestTeamRecord = (overrides?: Partial<TeamRecord>): TeamRecord => ({
  createdAt: "2026-01-01T00:00:00.000Z",
  groups: [],
  id: VALID_UUID,
  members: [],
  name: "Test Team",
  ...overrides,
});

const createMockSession = (overrides?: { email?: string; name?: string; userId?: string }) => ({
  session: {
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86_400_000),
    id: "session-123",
    token: "session-token",
    updatedAt: new Date(),
    userId: overrides?.userId ?? "user-123",
  },
  user: {
    createdAt: new Date(),
    email: overrides?.email ?? "test@example.com",
    emailVerified: true,
    id: overrides?.userId ?? "user-123",
    image: null,
    name: overrides?.name ?? "Test User",
    updatedAt: new Date(),
  },
});

const TEST_OWNER_ID = "owner-1";

/** The accounts the server tests act as; `user-123` is the one `createMockSession` signs in. */
const TEST_USERS = [
  { email: "test@example.com", id: "user-123", name: "Test User" },
  { email: "owner@example.com", id: TEST_OWNER_ID, name: "Owner" },
  ...["bob", "invitee", "member-1", "other", "user-1", "user-9", "user-456"].map((id) => ({
    email: `${id}@example.com`,
    id,
    name: null,
  })),
];

/** Empties this worker's database, then adds the test accounts and three spaces without contents. */
const resetTestDatabase = async (): Promise<void> => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  await prisma.user.createMany({ data: TEST_USERS });
  await prisma.space.createMany({
    data: [VALID_UUID, VALID_UUID_2, VALID_UUID_3].map((teamId) => ({
      ownerId: TEST_OWNER_ID,
      teamId,
    })),
  });
};

/** `test-uuid`, then `test-uuid-2`, …: member and group ids are primary keys. */
const createTestIds = () => {
  let issued = 0;

  return {
    next: () => {
      issued += 1;

      return issued === 1 ? "test-uuid" : `test-uuid-${issued}`;
    },
    reset: () => {
      issued = 0;
    },
  };
};

const createTestTeamStore = (createId?: () => string) => {
  const ids = createTestIds();
  const invalidateTeamName = vi.fn<TeamStoreDeps["invalidateTeamName"]>();
  const publish = vi.fn<TeamStorage["publish"]>().mockResolvedValue();

  const membershipStore = {
    grant: vi.fn(prismaMembershipStore.grant),
    revoke: vi.fn(prismaMembershipStore.revoke),
  };

  const store = createTeamStore({
    createId: createId ?? ids.next,
    invalidateTeamName,
    storage: { ...postgresTeamStorage, publish },
  });

  const { applyTeamCommand, changeTeamAccess } = store;

  const { grantMembership, grantViewerAccess, revokeMemberAccess } = createMembershipLifecycle({
    applyTeamCommand,
    changeTeamAccess,
    store: membershipStore,
  });

  return {
    applyTeamCommand,
    changeTeamAccess,
    createTeamContents: store.createTeamContents,
    findMembership: (userId: string, teamId = VALID_UUID) =>
      prisma.membership.findUnique({
        select: { archivedAt: true, role: true },
        where: { userId_teamId: { teamId, userId } },
      }),
    grantMembership,
    grantViewerAccess,
    invalidateTeamName,
    invitationStatus: async (memberId: string) => {
      const invitation = await prisma.invitation.findFirst({ where: { memberId } });

      return invitation?.status;
    },
    membershipStore,
    publish,
    readTeam: (teamId = VALID_UUID) => store.readTeamRecord(teamId),
    reset: async () => {
      await resetTestDatabase();
      ids.reset();
      publish.mockClear();
      membershipStore.grant.mockReset().mockImplementation(prismaMembershipStore.grant);
      membershipStore.revoke.mockReset().mockImplementation(prismaMembershipStore.revoke);
      invalidateTeamName.mockReset();
    },
    revokeMemberAccess,
    revokeMembership: ({ access, memberId }: { access: TeamAccess; memberId: string }) =>
      applyTeamCommand(
        access.teamId,
        teamCommands.removeMember(memberId),
        revokeMemberAccess(access),
      ),
    seedInvitation: (memberId: string, email = "invited@example.com") =>
      prisma.invitation.create({
        data: { email, invitedById: TEST_OWNER_ID, memberId, teamId: VALID_UUID },
      }),
    seedMembership: (userId: string, role: TeamRole = "MEMBER", archivedAt: Date | null = null) =>
      prisma.membership.create({ data: { archivedAt, role, teamId: VALID_UUID, userId } }),
    seedTeam: async (team: TeamRecord) => {
      await store.createTeamContents(team.id, team);
    },
  };
};

const createTestAccess = (teamId = VALID_UUID): TeamAccess => ({
  teamId,
  user: createMockSession().user,
});

const grant = (teamId: string) =>
  Promise.resolve({ data: createTestAccess(teamId), success: true as const });

const createTestGuards = () => {
  const authenticateCaller = vi.fn<typeof authenticate>();
  const authorizeAdmin = vi.fn<typeof authorizeTeamAdmin>();
  const authorizeMember = vi.fn<typeof authorizeTeamMember>();

  const reset = () => {
    authenticateCaller.mockReset();
    authenticateCaller.mockResolvedValue({ data: createMockSession().user, success: true });
    authorizeAdmin.mockReset();
    authorizeAdmin.mockImplementation(grant);
    authorizeMember.mockReset();
    authorizeMember.mockImplementation(grant);
  };

  reset();

  return {
    authenticate: authenticateCaller,
    authorizeTeamAdmin: authorizeAdmin,
    authorizeTeamMember: authorizeMember,
    reset,
  };
};

export {
  createMockSession,
  createTestAccess,
  createTestGuards,
  createTestGroup,
  createTestMember,
  createTestTeamRecord,
  createTestTeamStore,
  resetTestDatabase,
  TEST_OWNER_ID,
  VALID_UUID,
  VALID_UUID_2,
  VALID_UUID_3,
};
