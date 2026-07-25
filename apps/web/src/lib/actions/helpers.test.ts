import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireTeamAdmin } from "@/lib/team-auth";

import type * as ValidationModule from "../validation";

import { createTestMember, createTestTeamRecord, VALID_UUID } from "./test-helpers";

vi.mock("@/lib/team-auth", () => ({ requireTeamAdmin: vi.fn() }));

vi.mock("../redis", () => ({
  redis: { get: vi.fn(), set: vi.fn() },
  TEAM_ACTIVE_TTL_SECONDS: 100,
}));

vi.mock("../validation", async (importOriginal) => {
  const actual = await importOriginal<typeof ValidationModule>();
  return actual;
});

import { redis } from "../redis";

import { checkUuid, getTeamRecord, mutateTeam, sanitizeTeam } from "./helpers";

const mockedRedisGet = vi.mocked(redis.get);
const mockedRedisSet = vi.mocked(redis.set);
const mockedRequireTeamAdmin = vi.mocked(requireTeamAdmin);

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
    const { groups: _, ...teamWithoutGroups } = team;
    mockedRedisGet.mockResolvedValue(JSON.stringify(teamWithoutGroups));

    const result = await getTeamRecord(VALID_UUID);
    expect(result?.groups).toEqual([]);
  });

  it("backfills empty members array when missing", async () => {
    const team = createTestTeamRecord();
    const { members: _, ...teamWithoutMembers } = team;
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

describe("checkUuid", () => {
  it("returns ok for valid UUIDs", () => {
    expect(checkUuid(VALID_UUID, "team ID")).toEqual({ ok: true, value: undefined });
  });

  it("returns labelled error for invalid UUIDs", () => {
    expect(checkUuid("not-a-uuid", "member ID")).toEqual({
      error: "Invalid member ID",
      ok: false,
    });
  });
});

describe("mutateTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedRequireTeamAdmin.mockResolvedValue(undefined as never);
    mockedRedisSet.mockResolvedValue("OK");
  });

  it("returns 'Invalid team ID' for non-UUID teamId without auth or load", async () => {
    const mutate = vi.fn();

    const result = await mutateTeam({
      errorContext: "do thing",
      mutate,
      teamId: "not-a-uuid",
    });

    expect(result).toEqual({ error: "Invalid team ID", success: false });
    expect(mockedRequireTeamAdmin).not.toHaveBeenCalled();
    expect(mockedRedisGet).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("short-circuits on prelude failure before auth or load", async () => {
    const mutate = vi.fn();

    const result = await mutateTeam({
      errorContext: "do thing",
      mutate,
      prelude: () => ({ error: "Bad input", ok: false }),
      teamId: VALID_UUID,
    });

    expect(result).toEqual({ error: "Bad input", success: false });
    expect(mockedRequireTeamAdmin).not.toHaveBeenCalled();
    expect(mockedRedisGet).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("converts thrown auth errors to 'Failed to <errorContext>'", async () => {
    mockedRequireTeamAdmin.mockRejectedValue(new Error("Unauthorized"));

    const result = await mutateTeam({
      errorContext: "remove widget",
      mutate: () => ({ ok: true, value: 1 }),
      teamId: VALID_UUID,
    });

    expect(result).toEqual({ error: "Failed to remove widget", success: false });
  });

  it("returns 'Team not found' when redis has no team", async () => {
    mockedRedisGet.mockResolvedValue(null);
    const mutate = vi.fn();

    const result = await mutateTeam({
      errorContext: "do thing",
      mutate,
      teamId: VALID_UUID,
    });

    expect(result).toEqual({ error: "Team not found", success: false });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("passes prelude value into mutate and persists on success", async () => {
    const team = createTestTeamRecord();
    mockedRedisGet.mockResolvedValue(JSON.stringify(team));

    const result = await mutateTeam({
      errorContext: "do thing",
      mutate: (loaded, payload) => {
        loaded.name = payload;
        return { ok: true, value: payload };
      },
      prelude: () => ({ ok: true, value: "Renamed" }),
      teamId: VALID_UUID,
    });

    expect(result).toEqual({ data: "Renamed", success: true });
    expect(mockedRedisSet).toHaveBeenCalledTimes(1);
    const persisted = JSON.parse(mockedRedisSet.mock.calls[0][1] as string) as { name: string };
    expect(persisted.name).toBe("Renamed");
  });

  it("does not persist when mutate returns a domain error", async () => {
    mockedRedisGet.mockResolvedValue(JSON.stringify(createTestTeamRecord()));

    const result = await mutateTeam({
      errorContext: "do thing",
      mutate: () => ({ error: "Item not found", ok: false }),
      teamId: VALID_UUID,
    });

    expect(result).toEqual({ error: "Item not found", success: false });
    expect(mockedRedisSet).not.toHaveBeenCalled();
  });

  it("skips requireTeamAdmin when skipAdminCheck is true", async () => {
    mockedRedisGet.mockResolvedValue(JSON.stringify(createTestTeamRecord()));

    await mutateTeam({
      errorContext: "do thing",
      mutate: () => ({ ok: true, value: undefined }),
      skipAdminCheck: true,
      teamId: VALID_UUID,
    });

    expect(mockedRequireTeamAdmin).not.toHaveBeenCalled();
    expect(mockedRedisSet).toHaveBeenCalled();
  });

  it("supports async preludes", async () => {
    mockedRedisGet.mockResolvedValue(JSON.stringify(createTestTeamRecord()));

    const result = await mutateTeam({
      errorContext: "do thing",
      mutate: (_team, payload) => ({ ok: true, value: payload }),
      prelude: () => Promise.resolve({ ok: true as const, value: 42 }),
      teamId: VALID_UUID,
    });

    expect(result).toEqual({ data: 42, success: true });
  });
});
