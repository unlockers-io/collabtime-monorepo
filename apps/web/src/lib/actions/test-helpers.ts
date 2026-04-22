import type { TeamGroup, TeamMember, TeamRecord } from "@/types";

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
    expiresAt: new Date(Date.now() + 86_400_000),
    id: "session-123",
    userId: overrides?.userId ?? "user-123",
  },
  user: {
    email: overrides?.email ?? "test@example.com",
    id: overrides?.userId ?? "user-123",
    name: overrides?.name ?? "Test User",
  },
});

export {
  createMockSession,
  createTestGroup,
  createTestMember,
  createTestTeamRecord,
  VALID_UUID,
  VALID_UUID_2,
  VALID_UUID_3,
};
