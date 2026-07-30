import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestMember, createTestTeamRecord, VALID_UUID } from "./actions/test-helpers";

const { redisMock } = vi.hoisted(() => ({
  redisMock: { expire: vi.fn(), get: vi.fn(), set: vi.fn() },
}));

vi.mock("./redis", () => ({
  readTeamJson: async (teamId: string): Promise<string | null> => {
    const data: unknown = await redisMock.get(`team:${teamId}`);
    return typeof data === "string" && data !== "" ? data : null;
  },
  redis: redisMock,
  TEAM_ACTIVE_TTL_SECONDS: 100,
  teamKey: (teamId: string): string => `team:${teamId}`,
}));

vi.mock("./team-mirror", () => ({ writeTeamMirror: vi.fn() }));

import { redis } from "./redis";
import { writeTeamMirror } from "./team-mirror";
import { readTeamRecord, writeTeamRecord } from "./team-store";

const mockedRedisGet = vi.mocked(redis.get);
const mockedRedisSet = vi.mocked(redis.set);
const mockedWriteTeamMirror = vi.mocked(writeTeamMirror);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedRedisSet.mockResolvedValue("OK");
});

describe("readTeamRecord", () => {
  it("returns null for invalid UUID", async () => {
    const result = await readTeamRecord("not-a-uuid");

    expect(result).toBeNull();
    expect(mockedRedisGet).not.toHaveBeenCalled();
  });

  it("returns null when redis returns null", async () => {
    mockedRedisGet.mockResolvedValue(null);

    expect(await readTeamRecord(VALID_UUID)).toBeNull();
  });

  it("parses string data from redis", async () => {
    const team = createTestTeamRecord();
    mockedRedisGet.mockResolvedValue(JSON.stringify(team));

    const result = await readTeamRecord(VALID_UUID);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(team.id);
  });

  it("backfills empty groups array when missing", async () => {
    const { groups: _, ...teamWithoutGroups } = createTestTeamRecord();
    mockedRedisGet.mockResolvedValue(JSON.stringify(teamWithoutGroups));

    const result = await readTeamRecord(VALID_UUID);
    expect(result?.groups).toEqual([]);
  });

  it("backfills empty members array when missing", async () => {
    const { members: _, ...teamWithoutMembers } = createTestTeamRecord();
    mockedRedisGet.mockResolvedValue(JSON.stringify(teamWithoutMembers));

    const result = await readTeamRecord(VALID_UUID);
    expect(result?.members).toEqual([]);
  });

  it("backfills missing order on members", async () => {
    const memberWithoutOrder = { ...createTestMember(), order: undefined };
    const team = createTestTeamRecord({ members: [memberWithoutOrder as never] });
    mockedRedisGet.mockResolvedValue(JSON.stringify(team));

    const result = await readTeamRecord(VALID_UUID);
    expect(result?.members[0].order).toBe(0);
  });

  it("returns null on redis error", async () => {
    mockedRedisGet.mockRejectedValue(new Error("connection failed"));

    expect(await readTeamRecord(VALID_UUID)).toBeNull();
  });
});

describe("writeTeamRecord", () => {
  it("writes the blob to redis and mirrors it to postgres", async () => {
    const team = createTestTeamRecord();

    await writeTeamRecord(VALID_UUID, team);

    expect(mockedRedisSet).toHaveBeenCalledWith(
      `team:${VALID_UUID}`,
      JSON.stringify(team),
      "EX",
      100,
    );
    expect(mockedWriteTeamMirror).toHaveBeenCalledWith(VALID_UUID, team);
  });

  it("honours a caller-supplied TTL", async () => {
    await writeTeamRecord(VALID_UUID, createTestTeamRecord(), 42);

    expect(mockedRedisSet.mock.calls[0][3]).toBe(42);
  });

  it("resolves when the mirror fails so the redis write still counts", async () => {
    mockedWriteTeamMirror.mockRejectedValue(new Error("postgres down"));

    await expect(writeTeamRecord(VALID_UUID, createTestTeamRecord())).resolves.toBeUndefined();
    expect(mockedRedisSet).toHaveBeenCalledTimes(1);
  });

  it("propagates a redis failure and skips the mirror", async () => {
    mockedRedisSet.mockRejectedValue(new Error("connection failed"));

    await expect(writeTeamRecord(VALID_UUID, createTestTeamRecord())).rejects.toThrow(
      "connection failed",
    );
    expect(mockedWriteTeamMirror).not.toHaveBeenCalled();
  });
});
