import { vi } from "vitest";

import type { TeamGroup, TeamMember, TeamRecord } from "@/types";

import { createTeamMutator } from "./helpers";
import type { TeamMutatorDeps } from "./helpers";

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

const createTestTeamMutator = () => {
  let team: TeamRecord | null = null;
  let readFailure = false;
  let writeFailure = false;

  const applyTeamContents: TeamMutatorDeps["applyTeamContents"] = (_teamId, mutate) => {
    if (readFailure) {
      return Promise.resolve({
        error: "Could not read the team",
        ok: false,
        reason: "read-failed",
      });
    }
    const outcome = mutate(team);
    if (!outcome.ok) {
      return Promise.resolve({ error: outcome.error, ok: false, reason: "rejected" });
    }
    if (writeFailure) {
      return Promise.resolve({
        error: "Failed to save the team",
        ok: false,
        reason: "write-failed",
      });
    }
    team = outcome.team;
    return Promise.resolve({ ok: true, value: outcome.value });
  };

  const requireTeamAdmin = vi.fn<TeamMutatorDeps["requireTeamAdmin"]>();
  const reportError = vi.fn<TeamMutatorDeps["reportError"]>();
  const mutateTeam = createTeamMutator({ applyTeamContents, reportError, requireTeamAdmin });

  return {
    mutateTeam,
    persistedTeam: () => team,
    reportError,
    requireTeamAdmin,
    reset: () => {
      team = null;
      readFailure = false;
      writeFailure = false;
      requireTeamAdmin.mockReset();
      requireTeamAdmin.mockResolvedValue("user-123");
      reportError.mockReset();
    },
    seedTeam: (nextTeam: TeamRecord | null) => {
      team = nextTeam;
    },
    setReadFailure: (value: boolean) => {
      readFailure = value;
    },
    setWriteFailure: (value: boolean) => {
      writeFailure = value;
    },
  };
};

export {
  createMockSession,
  createTestGroup,
  createTestMember,
  createTestTeamRecord,
  createTestTeamMutator,
  VALID_UUID,
  VALID_UUID_2,
  VALID_UUID_3,
};
