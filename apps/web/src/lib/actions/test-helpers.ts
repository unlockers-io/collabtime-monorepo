import { vi } from "vitest";

import type {
  authenticate,
  authorizeTeamAdmin,
  authorizeTeamMember,
  TeamAccess,
} from "@/lib/team-auth";
import type { TeamGroup, TeamMember, TeamRecord } from "@/types";

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
  const build = () =>
    createTeamStore({
      createId,
      invalidateTeamName,
      reportError,
      storage: createMemoryTeamStorage(),
    });
  let store = build();

  return {
    invalidateTeamName,
    mutateTeam: createTeamMutator({
      applyTeamCommand: (teamId, command) => store.applyTeamCommand(teamId, command),
      reportError,
    }),
    readTeam: () => store.readTeamRecord(VALID_UUID),
    reportError,
    reset: () => {
      store = build();
      invalidateTeamName.mockReset();
      reportError.mockReset();
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
