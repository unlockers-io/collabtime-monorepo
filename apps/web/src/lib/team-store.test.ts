import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestMember, createTestTeamRecord, VALID_UUID } from "./actions/test-helpers";

const { isRedisConfiguredMock, redisMock } = vi.hoisted(() => ({
  isRedisConfiguredMock: vi.fn(() => true),
  redisMock: { expire: vi.fn(), get: vi.fn(), set: vi.fn() },
}));

vi.mock("./redis", () => ({
  isRedisConfigured: isRedisConfiguredMock,
  readTeamJson: async (teamId: string): Promise<string | null> => {
    const data: unknown = await redisMock.get(`team:${teamId}`);
    return typeof data === "string" && data !== "" ? data : null;
  },
  redis: redisMock,
  TEAM_ACTIVE_TTL_SECONDS: 100,
  teamKey: (teamId: string): string => `team:${teamId}`,
}));

vi.mock("./team-mirror", () => ({ writeTeamMirror: vi.fn() }));
vi.mock("uuid", () => ({ v4: vi.fn(() => "test-uuid") }));

import { redis } from "./redis";
import { writeTeamMirror } from "./team-mirror";
import {
  applyTeamContents,
  newTeamMember,
  readTeamRecord,
  readTeamSummary,
  writeTeamRecord,
} from "./team-store";

const mockedRedisGet = vi.mocked(redis.get);
const mockedRedisSet = vi.mocked(redis.set);
const mockedWriteTeamMirror = vi.mocked(writeTeamMirror);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedRedisSet.mockResolvedValue("OK");
  isRedisConfiguredMock.mockReturnValue(true);
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

  it("still reads a legacy blob the schema rejects", async () => {
    const memberWithoutTitle = { ...createTestMember(), title: undefined };
    const { createdAt: _, ...legacyTeam } = createTestTeamRecord({
      members: [memberWithoutTitle as never],
    });
    mockedRedisGet.mockResolvedValue(JSON.stringify(legacyTeam));

    const result = await readTeamRecord(VALID_UUID);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(legacyTeam.id);
    expect(result?.name).toBe(legacyTeam.name);
    expect(result?.members).toHaveLength(1);
    expect(result?.members[0]).toMatchObject({ name: "Alice", order: 0 });
  });

  it("keeps unrecognised keys on a rescued blob so a write does not erase them", async () => {
    const { name: _, ...legacyTeam } = createTestTeamRecord();
    mockedRedisGet.mockResolvedValue(JSON.stringify({ ...legacyTeam, futureField: "keep me" }));

    expect(await readTeamRecord(VALID_UUID)).toMatchObject({ futureField: "keep me", name: "" });
  });

  it("returns null when the blob holds no fields to read", async () => {
    mockedRedisGet.mockResolvedValue("42");

    expect(await readTeamRecord(VALID_UUID)).toBeNull();
  });
});

describe("readTeamSummary", () => {
  it("returns the name and member count", async () => {
    const team = createTestTeamRecord({ members: [createTestMember()] });
    mockedRedisGet.mockResolvedValue(JSON.stringify(team));

    expect(await readTeamSummary(VALID_UUID)).toEqual({ memberCount: 1, name: team.name });
  });

  it("counts zero members for a team stored without a members array", async () => {
    const { members: _, ...teamWithoutMembers } = createTestTeamRecord();
    mockedRedisGet.mockResolvedValue(JSON.stringify(teamWithoutMembers));

    expect(await readTeamSummary(VALID_UUID)).toEqual({
      memberCount: 0,
      name: teamWithoutMembers.name,
    });
  });

  it("returns null for an unparseable blob rather than throwing", async () => {
    mockedRedisGet.mockResolvedValue("not json");

    expect(await readTeamSummary(VALID_UUID)).toBeNull();
  });

  it("summarises a legacy blob the schema rejects instead of hiding the team", async () => {
    const memberWithoutTitle = { ...createTestMember(), title: undefined };
    const { createdAt: _, ...legacyTeam } = createTestTeamRecord({
      members: [memberWithoutTitle as never],
    });
    mockedRedisGet.mockResolvedValue(JSON.stringify(legacyTeam));

    expect(await readTeamSummary(VALID_UUID)).toEqual({ memberCount: 1, name: legacyTeam.name });
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

describe("newTeamMember", () => {
  it("fills the shared defaults and lets a caller override them", () => {
    expect(newTeamMember()).toEqual({
      id: "test-uuid",
      name: "",
      order: 0,
      timezone: "America/New_York",
      title: "",
      workingHoursEnd: 17,
      workingHoursStart: 9,
    });
    expect(newTeamMember({ order: 3, timezone: "Europe/Berlin" })).toMatchObject({
      order: 3,
      timezone: "Europe/Berlin",
      workingHoursStart: 9,
    });
  });
});

describe("applyTeamContents", () => {
  it("writes the mutated record and returns the mutation's value", async () => {
    mockedRedisGet.mockResolvedValue(JSON.stringify(createTestTeamRecord()));

    const result = await applyTeamContents(VALID_UUID, (team) => {
      if (team === null) {
        return { error: "Team not found", ok: false };
      }
      team.members.push(createTestMember());
      return { ok: true, team, value: "written" };
    });

    expect(result).toEqual({ ok: true, value: "written" });
    const written = JSON.parse(mockedRedisSet.mock.calls[0][1] as string) as {
      members: Array<unknown>;
    };
    expect(written.members).toHaveLength(1);
  });

  it("does not report success when the write fails", async () => {
    mockedRedisGet.mockResolvedValue(JSON.stringify(createTestTeamRecord()));
    mockedRedisSet.mockRejectedValue(new Error("connection failed"));

    const result = await applyTeamContents(VALID_UUID, (team) => ({
      ok: true,
      team,
      value: undefined,
    }));

    expect(result).toEqual({
      error: "Failed to save the team",
      ok: false,
      reason: "write-failed",
    });
  });

  it("reports an unconfigured store instead of a phantom success", async () => {
    isRedisConfiguredMock.mockReturnValue(false);

    const result = await applyTeamContents(VALID_UUID, (team) => ({
      ok: true,
      team,
      value: undefined,
    }));

    expect(result).toEqual({
      error: "Team storage is unavailable",
      ok: false,
      reason: "unconfigured",
    });
    expect(mockedRedisSet).not.toHaveBeenCalled();
  });

  it("passes a null record through so the mutation can refuse", async () => {
    mockedRedisGet.mockResolvedValue(null);

    const result = await applyTeamContents(VALID_UUID, (team) =>
      team === null ? { error: "Team not found", ok: false } : { ok: true, team, value: undefined },
    );

    expect(result).toEqual({ error: "Team not found", ok: false, reason: "rejected" });
    expect(mockedRedisSet).not.toHaveBeenCalled();
  });

  it("skips the write when the mutation has nothing to persist", async () => {
    mockedRedisGet.mockResolvedValue(JSON.stringify(createTestTeamRecord()));

    const result = await applyTeamContents(VALID_UUID, () => ({
      ok: true,
      team: null,
      value: "unchanged",
    }));

    expect(result).toEqual({ ok: true, value: "unchanged" });
    expect(mockedRedisSet).not.toHaveBeenCalled();
  });
});
