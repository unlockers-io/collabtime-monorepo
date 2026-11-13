// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPrisma } from "@/lib/db";

import { readTeamRecord } from "../team-store";

import { createTeamAction } from "./team-create-core";
import {
  createTestGuards,
  createTestMember,
  resetTestDatabase,
  TEST_OWNER_ID,
  VALID_UUID,
} from "./test-helpers";

const TEAM_ID = "880e8400-e29b-41d4-a716-446655440003";
const USER_ID = "user-123";
const guards = createTestGuards();
const createId = vi.fn<() => string>();

const createTeam = createTeamAction({
  authenticate: guards.authenticate,
  createId,
  createMember: createTestMember,
  now: () => new Date("2026-01-01"),
  reportError: vi.fn<() => void>(),
});

const administer = async (count: number) => {
  const teamIds = Array.from({ length: count }, () => crypto.randomUUID());

  await getPrisma().space.createMany({
    data: teamIds.map((teamId) => ({ ownerId: TEST_OWNER_ID, teamId })),
  });
  await getPrisma().membership.createMany({
    data: teamIds.map((teamId) => ({ role: "ADMIN" as const, teamId, userId: USER_ID })),
  });
};

const created = () => getPrisma().space.findUnique({ where: { teamId: TEAM_ID } });

beforeEach(async () => {
  guards.reset();
  createId.mockReset().mockReturnValue(TEAM_ID);
  await resetTestDatabase();
});

describe("create team", () => {
  it.each(["", "   ", "a".repeat(101)])("rejects invalid names %s", async (name) => {
    expect(await createTeam("Europe/Berlin", name)).toMatchObject({ success: false });
    expect(await created()).toBeNull();
  });

  it("requires a session", async () => {
    guards.authenticate.mockResolvedValue({ error: "Authentication required", success: false });
    expect(await createTeam("Europe/Berlin", "Team")).toMatchObject({ success: false });
    expect(await created()).toBeNull();
  });

  it("stores the space, the team with its claimed creator, and their admin membership", async () => {
    expect(await createTeam("Europe/Berlin", "  Team  ")).toEqual({
      data: TEAM_ID,
      success: true,
    });
    expect(await created()).toMatchObject({ isPrivate: false, ownerId: USER_ID });
    expect(await readTeamRecord(TEAM_ID)).toMatchObject({
      createdAt: "2026-01-01T00:00:00.000Z",
      members: [{ timezone: "Europe/Berlin", userId: USER_ID }],
      name: "Team",
    });
    expect(
      await getPrisma().membership.findUnique({
        where: { userId_teamId: { teamId: TEAM_ID, userId: USER_ID } },
      }),
    ).toMatchObject({ archivedAt: null, role: "ADMIN" });
  });

  it("stores nothing when the transaction fails", async () => {
    createId.mockReturnValue(VALID_UUID);

    expect(await createTeam("Europe/Berlin", "Team")).toEqual({
      error: "Failed to create team",
      success: false,
    });
    expect(await readTeamRecord(VALID_UUID)).toBeNull();
    expect(await getPrisma().membership.count({ where: { userId: USER_ID } })).toBe(0);
  });

  it.each([49, 50])("enforces the administration limit at %i", async (count) => {
    await administer(count);
    const result = await createTeam("Europe/Berlin", "Team");

    expect(result.success).toBe(count < 50);
    expect((await created()) !== null).toBe(count < 50);
  });
});
