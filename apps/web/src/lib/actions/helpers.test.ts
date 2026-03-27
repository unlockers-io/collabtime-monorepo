import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamRecord } from "@/types";

import { createTestMember, createTestTeamRecord, VALID_UUID } from "./__tests__/test-helpers";

vi.mock("../redis", () => ({
  redis: { get: vi.fn() },
}));

vi.mock("../validation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../validation")>();
  return actual;
});

import { redis } from "../redis";

import { getTeamRecord, sanitizeTeam } from "./helpers";

const mockedRedisGet = vi.mocked(redis.get);

describe("sanitizeTeam", () => {
  it("strips adminPasswordHash from output", () => {
    const team = createTestTeamRecord({ adminPasswordHash: "secret-hash" });
    const result = sanitizeTeam(team);

    expect(result).not.toHaveProperty("adminPasswordHash");
  });

  it("preserves userId when it matches currentUserId", () => {
    const team = createTestTeamRecord({
      members: [createTestMember({ userId: "user-123" })],
    });

    const result = sanitizeTeam(team, "user-123");
    expect(result.members[0].userId).toBe("user-123");
  });

  it("replaces other users' userIds with 'claimed'", () => {
    const team = createTestTeamRecord({
      members: [createTestMember({ userId: "other-user" })],
    });

    const result = sanitizeTeam(team, "user-123");
    expect(result.members[0].userId).toBe("claimed");
  });

  it("omits userId for unclaimed members", () => {
    const team = createTestTeamRecord({
      members: [createTestMember({ userId: undefined })],
    });

    const result = sanitizeTeam(team, "user-123");
    expect(result.members[0]).not.toHaveProperty("userId");
  });

  it("handles team with no members", () => {
    const team = createTestTeamRecord({ members: [] });
    const result = sanitizeTeam(team);

    expect(result.members).toEqual([]);
  });
});

describe("getTeamRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for invalid UUID", async () => {
    const result = await getTeamRecord("not-a-uuid");
    expect(result).toBeNull();
    expect(mockedRedisGet).not.toHaveBeenCalled();
  });

  it("returns null when redis returns null", async () => {
    mockedRedisGet.mockResolvedValue(null);
    const result = await getTeamRecord(VALID_UUID);

    expect(result).toBeNull();
  });

  it("parses string data from redis", async () => {
    const team = createTestTeamRecord();
    mockedRedisGet.mockResolvedValue(JSON.stringify(team));

    const result = await getTeamRecord(VALID_UUID);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(team.id);
  });

  it("backfills empty groups array when missing", async () => {
    const team = createTestTeamRecord();
    const teamWithoutGroups = { ...team } as TeamRecord & { groups?: unknown };
    delete teamWithoutGroups.groups;
    mockedRedisGet.mockResolvedValue(JSON.stringify(teamWithoutGroups));

    const result = await getTeamRecord(VALID_UUID);
    expect(result?.groups).toEqual([]);
  });

  it("backfills empty members array when missing", async () => {
    const team = createTestTeamRecord();
    const teamWithoutMembers = { ...team } as TeamRecord & { members?: unknown };
    delete teamWithoutMembers.members;
    mockedRedisGet.mockResolvedValue(JSON.stringify(teamWithoutMembers));

    const result = await getTeamRecord(VALID_UUID);
    expect(result?.members).toEqual([]);
  });

  it("backfills missing order on members", async () => {
    const memberWithoutOrder = { ...createTestMember(), order: undefined };
    const team = createTestTeamRecord({ members: [memberWithoutOrder as never] });
    mockedRedisGet.mockResolvedValue(JSON.stringify(team));

    const result = await getTeamRecord(VALID_UUID);
    expect(result?.members[0].order).toBe(0);
  });

  it("returns null on redis error", async () => {
    mockedRedisGet.mockRejectedValue(new Error("connection failed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getTeamRecord(VALID_UUID);
    expect(result).toBeNull();

    consoleSpy.mockRestore();
  });
});
