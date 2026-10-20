import { vi } from "vitest";

import type {
  authenticate,
  authorizeTeamAdmin,
  authorizeTeamMember,
  TeamAccess,
} from "@/lib/team-auth";
import type { TeamGroup, TeamMember, TeamRecord, TeamRole } from "@/types";

import { createMembershipLifecycle, type MembershipStore } from "../membership";
import { createMemoryMembershipStore } from "../membership-memory-store";
import { createMemoryTeamStorage } from "../team-memory-storage";
import { createTeamStore, type TeamStoreDeps } from "../team-store";

import { createTeamMutator } from "./helpers";

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

const createTestTeamStore = (createId: () => string = () => "test-uuid") => {
  const invalidateTeamName = vi.fn<TeamStoreDeps["invalidateTeamName"]>();
  const reportError = vi.fn<TeamStoreDeps["reportError"]>();
  let memberships = createMemoryMembershipStore();
  let teamStorage = createMemoryTeamStorage();
  const lock: MembershipStore<undefined>["lock"] = (teamId, run) =>
    teamStorage.transaction(teamId, () => memberships.lock(teamId, run));
  const membershipStore = {
    grant: vi.fn<MembershipStore<undefined>["grant"]>(),
    lock,
    revoke: vi.fn<MembershipStore<undefined>["revoke"]>(),
  };
  const build = () =>
    createTeamStore({
      createId,
      invalidateTeamName,
      reportError,
      storage: teamStorage,
    });
  let store = build();
  const wireMemberships = () => {
    memberships = createMemoryMembershipStore();
    membershipStore.grant
      .mockReset()
      .mockImplementation((grant) => memberships.grant(grant, undefined));
    membershipStore.revoke
      .mockReset()
      .mockImplementation((revocation) => memberships.revoke(revocation, undefined));
  };
  wireMemberships();

  const applyTeamCommand: typeof store.applyTeamCommand = (teamId, command) =>
    store.applyTeamCommand(teamId, command);
  const publish = vi.fn<(teamId: string) => Promise<void>>().mockResolvedValue();
  const applyInTransaction: typeof store.applyInTransaction = (teamId, command, transaction) =>
    store.applyInTransaction(teamId, command, transaction);
  const { grantMembership, revokeMembership } = createMembershipLifecycle({
    applyTeamCommand: applyInTransaction,
    publish,
    store: membershipStore,
  });

  return {
    applyInTransaction,
    applyTeamCommand,
    createTeamContents: (teamId: string, team: TeamRecord) =>
      store.createTeamContents(teamId, team),
    findMembership: (userId: string, teamId = VALID_UUID) => memberships.read(teamId, userId),
    grantMembership,
    invalidateTeamName,
    invitationsRevoked: (memberId: string) => memberships.invitationsRevoked(VALID_UUID, memberId),
    membershipStore,
    mutateTeam: createTeamMutator({ applyTeamCommand, reportError }),
    publish,
    readTeam: (teamId = VALID_UUID) => store.readTeamRecord(teamId),
    reportError,
    reset: () => {
      teamStorage = createMemoryTeamStorage();
      store = build();
      publish.mockClear();
      wireMemberships();
      invalidateTeamName.mockReset();
      reportError.mockReset();
    },
    revokeMembership,
    seedMembership: (userId: string, role: TeamRole = "MEMBER", archivedAt: Date | null = null) => {
      memberships.seed(VALID_UUID, userId, { archivedAt, role });
    },
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
  VALID_UUID,
  VALID_UUID_2,
  VALID_UUID_3,
};
