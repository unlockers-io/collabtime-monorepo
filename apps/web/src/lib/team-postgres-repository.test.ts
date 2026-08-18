import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestGroup, createTestMember, createTestTeamRecord } from "./actions/test-helpers";
import { createTeamPostgresReader, diffTeamMirror } from "./team-postgres-repository";

const findTeamMirror = vi.fn<Parameters<typeof createTeamPostgresReader>[0]["findTeamMirror"]>();
const findTeamSummaries =
  vi.fn<Parameters<typeof createTeamPostgresReader>[0]["findTeamSummaries"]>();
const { readTeamMirror, readTeamSummariesFromPostgres } = createTeamPostgresReader({
  findTeamMirror,
  findTeamSummaries,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("diffTeamMirror", () => {
  it("reports a team that never reached postgres", () => {
    expect(diffTeamMirror(createTestTeamRecord(), null)).toEqual(["missing from Postgres"]);
  });

  it("accepts records that differ only by createdAt", () => {
    const expected = createTestTeamRecord();
    const actual = { ...expected, createdAt: new Date(0).toISOString() };

    expect(diffTeamMirror(expected, actual)).toEqual([]);
  });

  it("accepts groups and members that arrive in a different order", () => {
    const groups = [createTestGroup({ id: "g-1" }), createTestGroup({ id: "g-2", order: 1 })];
    const members = [createTestMember({ id: "m-1" }), createTestMember({ id: "m-2", order: 1 })];
    const expected = createTestTeamRecord({ groups, members });
    const actual = createTestTeamRecord({
      groups: groups.toReversed(),
      members: members.toReversed(),
    });

    expect(diffTeamMirror(expected, actual)).toEqual([]);
  });

  it("reports a renamed team", () => {
    const expected = createTestTeamRecord({ name: "Design" });
    const actual = createTestTeamRecord({ name: "Design Team" });

    expect(diffTeamMirror(expected, actual)).toEqual(['name "Design" != "Design Team"']);
  });

  it("reports an admin password that failed to mirror", () => {
    const expected = createTestTeamRecord({ adminPasswordHash: "hash" });

    expect(diffTeamMirror(expected, createTestTeamRecord())).toEqual(["adminPasswordHash differs"]);
  });

  it("reports a member whose fields drifted", () => {
    const expected = createTestTeamRecord({ members: [createTestMember({ title: "Engineer" })] });
    const actual = createTestTeamRecord({ members: [createTestMember({ title: "Designer" })] });

    expect(diffTeamMirror(expected, actual)).toEqual(["members differ (1 vs 1)"]);
  });

  it("reports drift that only moves a word across a field boundary", () => {
    const expected = createTestTeamRecord({
      members: [createTestMember({ name: "Ada Byron", title: "Engineer" })],
    });
    const actual = createTestTeamRecord({
      members: [createTestMember({ name: "Ada", title: "Byron Engineer" })],
    });

    expect(diffTeamMirror(expected, actual)).toEqual(["members differ (1 vs 1)"]);
  });

  it("reports a missing group", () => {
    const expected = createTestTeamRecord({ groups: [createTestGroup()] });
    const actual = createTestTeamRecord({ groups: [] });

    expect(diffTeamMirror(expected, actual)).toEqual(["groups differ (1 vs 0)"]);
  });
});

describe("readTeamMirror", () => {
  it("returns null when the space row is gone", async () => {
    findTeamMirror.mockResolvedValue(null);

    expect(await readTeamMirror("team-1")).toBeNull();
  });

  it("omits groupId and userId rather than carrying nulls into the record", async () => {
    findTeamMirror.mockResolvedValue({
      adminPasswordHash: null,
      createdAt: new Date("2026-01-15T00:00:00.000Z"),
      groups: [{ id: "g-1", name: "Design", order: 0 }],
      members: [
        {
          groupId: null,
          id: "m-1",
          name: "Ada",
          order: 0,
          timezone: "UTC",
          title: "",
          userId: null,
          workingHoursEnd: 17,
          workingHoursStart: 9,
        },
      ],
      name: "Acme",
      teamId: "team-1",
    });

    const record = await readTeamMirror("team-1");

    expect(record).not.toHaveProperty("adminPasswordHash");
    expect(record?.members[0]).not.toHaveProperty("groupId");
    expect(record?.members[0]).not.toHaveProperty("userId");
    expect(record?.createdAt).toBe("2026-01-15T00:00:00.000Z");
    expect(record?.id).toBe("team-1");
  });
});

describe("readTeamSummariesFromPostgres", () => {
  it("maps one batch query into summaries keyed by team id", async () => {
    findTeamSummaries.mockResolvedValue([
      { members: [{ id: "m-1" }], name: "Design", teamId: "team-1" },
      { members: [], name: "Research", teamId: "team-2" },
    ]);

    const summaries = await readTeamSummariesFromPostgres(["team-1", "team-2"]);

    expect(findTeamSummaries).toHaveBeenCalledWith(["team-1", "team-2"]);
    expect(summaries).toEqual(
      new Map([
        ["team-1", { memberCount: 1, name: "Design" }],
        ["team-2", { memberCount: 0, name: "Research" }],
      ]),
    );
  });
});
