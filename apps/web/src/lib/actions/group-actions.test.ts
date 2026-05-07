import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireTeamAdmin } from "@/lib/team-auth";

import {
  createTestGroup,
  createTestMember,
  createTestTeamRecord,
  VALID_UUID,
  VALID_UUID_2,
  VALID_UUID_3,
} from "./test-helpers";

vi.mock("@/lib/team-auth", () => ({ requireTeamAdmin: vi.fn() }));
vi.mock("../redis", () => ({
  redis: { get: vi.fn(), set: vi.fn() },
  TEAM_ACTIVE_TTL_SECONDS: 100,
}));
vi.mock("uuid", () => ({ v4: vi.fn(() => "test-uuid") }));

import { redis } from "../redis";

import { createGroup, removeGroup, reorderGroups, updateGroup } from "./group-actions";

const mockedRequireTeamAdmin = vi.mocked(requireTeamAdmin);
const mockedRedisGet = vi.mocked(redis.get);
const mockedRedisSet = vi.mocked(redis.set);

const seedTeam = (team: ReturnType<typeof createTestTeamRecord>) => {
  mockedRedisGet.mockResolvedValue(JSON.stringify(team));
};

const persistedTeam = () => {
  const lastCall = mockedRedisSet.mock.calls.at(-1);
  if (!lastCall) {
    throw new Error("redis.set was not called");
  }
  return JSON.parse(lastCall[1] as string) as ReturnType<typeof createTestTeamRecord>;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedRequireTeamAdmin.mockResolvedValue(undefined as never);
  mockedRedisSet.mockResolvedValue("OK" as never);
});

describe("createGroup", () => {
  it("returns error when teamId is not a UUID", async () => {
    const result = await createGroup("not-a-uuid", { name: "Design" });

    expect(result).toEqual({ error: "Invalid team ID", success: false });
  });

  it("returns error when name is empty", async () => {
    const result = await createGroup(VALID_UUID, { name: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.toLowerCase()).toContain("name");
    }
  });

  it("returns error when auth check fails", async () => {
    mockedRequireTeamAdmin.mockRejectedValue(new Error("Unauthorized"));

    const result = await createGroup(VALID_UUID, { name: "Design" });

    expect(result).toEqual({ error: "Failed to create group", success: false });
  });

  it("returns error when team is not found", async () => {
    mockedRedisGet.mockResolvedValue(null);

    const result = await createGroup(VALID_UUID, { name: "Design" });

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("assigns order based on existing group count", async () => {
    seedTeam(
      createTestTeamRecord({
        groups: [createTestGroup({ id: "g1", order: 0 }), createTestGroup({ id: "g2", order: 1 })],
      }),
    );

    const result = await createGroup(VALID_UUID, { name: "Design" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.group.order).toBe(2);
      expect(result.data.group.name).toBe("Design");
      expect(result.data.group.id).toBe("test-uuid");
    }
  });

  it("persists the new group via redis.set", async () => {
    seedTeam(createTestTeamRecord({ groups: [] }));

    await createGroup(VALID_UUID, { name: "Design" });

    const saved = persistedTeam();
    expect(saved.groups).toHaveLength(1);
    expect(saved.groups[0].name).toBe("Design");
  });
});

describe("updateGroup", () => {
  it("returns error when groupId is not a UUID", async () => {
    const result = await updateGroup(VALID_UUID, "not-a-uuid", { name: "X" });

    expect(result).toEqual({ error: "Invalid group ID", success: false });
  });

  it("returns error when team is not found", async () => {
    mockedRedisGet.mockResolvedValue(null);

    const result = await updateGroup(VALID_UUID, VALID_UUID_2, { name: "New Name" });

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("returns error when group is not found", async () => {
    seedTeam(createTestTeamRecord({ groups: [createTestGroup()] }));

    const result = await updateGroup(VALID_UUID, VALID_UUID_3, { name: "New Name" });

    expect(result).toEqual({ error: "Group not found", success: false });
  });

  it("persists the updated group", async () => {
    seedTeam(
      createTestTeamRecord({
        groups: [createTestGroup({ id: VALID_UUID_2, name: "Engineering" })],
      }),
    );

    const result = await updateGroup(VALID_UUID, VALID_UUID_2, { name: "Product" });

    expect(result.success).toBe(true);
    expect(persistedTeam().groups[0].name).toBe("Product");
  });
});

describe("removeGroup", () => {
  it("returns error when groupId is not a UUID", async () => {
    const result = await removeGroup(VALID_UUID, "not-a-uuid");

    expect(result).toEqual({ error: "Invalid group ID", success: false });
  });

  it("returns error when team is not found", async () => {
    mockedRedisGet.mockResolvedValue(null);

    const result = await removeGroup(VALID_UUID, VALID_UUID_2);

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("returns error when group is not found", async () => {
    seedTeam(createTestTeamRecord({ groups: [createTestGroup({ id: VALID_UUID_3 })] }));

    const result = await removeGroup(VALID_UUID, VALID_UUID_2);

    expect(result).toEqual({ error: "Group not found", success: false });
  });

  it("unassigns members belonging to the removed group", async () => {
    const groupId = VALID_UUID_2;
    seedTeam(
      createTestTeamRecord({
        groups: [createTestGroup({ id: groupId })],
        members: [
          createTestMember({ groupId, id: "m1" }),
          createTestMember({ groupId: VALID_UUID_3, id: "m2" }),
          createTestMember({ groupId: undefined, id: "m3" }),
        ],
      }),
    );

    const result = await removeGroup(VALID_UUID, groupId);

    expect(result.success).toBe(true);
    const saved = persistedTeam();
    const m1 = saved.members.find((m) => m.id === "m1");
    const m2 = saved.members.find((m) => m.id === "m2");
    const m3 = saved.members.find((m) => m.id === "m3");
    expect(m1?.groupId).toBeUndefined();
    expect(m2?.groupId).toBe(VALID_UUID_3);
    expect(m3?.groupId).toBeUndefined();
  });

  it("reindexes remaining group order values", async () => {
    seedTeam(
      createTestTeamRecord({
        groups: [
          createTestGroup({ id: "g1", name: "A", order: 0 }),
          createTestGroup({ id: VALID_UUID_2, name: "B", order: 1 }),
          createTestGroup({ id: "g3", name: "C", order: 2 }),
        ],
        members: [],
      }),
    );

    const result = await removeGroup(VALID_UUID, VALID_UUID_2);

    expect(result.success).toBe(true);
    const saved = persistedTeam();
    expect(saved.groups).toHaveLength(2);
    expect(saved.groups[0]).toEqual(expect.objectContaining({ id: "g1", order: 0 }));
    expect(saved.groups[1]).toEqual(expect.objectContaining({ id: "g3", order: 1 }));
  });
});

describe("reorderGroups", () => {
  it("returns error when team is not found", async () => {
    mockedRedisGet.mockResolvedValue(null);

    const result = await reorderGroups(VALID_UUID, ["g1"]);

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("returns error when group IDs do not match existing groups", async () => {
    seedTeam(
      createTestTeamRecord({
        groups: [createTestGroup({ id: "g1", order: 0 }), createTestGroup({ id: "g2", order: 1 })],
      }),
    );

    const result = await reorderGroups(VALID_UUID, ["g1", "g3"]);

    expect(result).toEqual({ error: "Invalid group order", success: false });
  });

  it("returns error when group IDs count mismatches", async () => {
    seedTeam(
      createTestTeamRecord({
        groups: [createTestGroup({ id: "g1", order: 0 }), createTestGroup({ id: "g2", order: 1 })],
      }),
    );

    const result = await reorderGroups(VALID_UUID, ["g1"]);

    expect(result).toEqual({ error: "Invalid group order", success: false });
  });

  it("updates order values based on new positions", async () => {
    seedTeam(
      createTestTeamRecord({
        groups: [
          createTestGroup({ id: "g1", name: "A", order: 0 }),
          createTestGroup({ id: "g2", name: "B", order: 1 }),
          createTestGroup({ id: "g3", name: "C", order: 2 }),
        ],
      }),
    );

    const result = await reorderGroups(VALID_UUID, ["g3", "g1", "g2"]);

    expect(result.success).toBe(true);
    const saved = persistedTeam();
    expect(saved.groups[0]).toEqual(expect.objectContaining({ id: "g3", order: 0 }));
    expect(saved.groups[1]).toEqual(expect.objectContaining({ id: "g1", order: 1 }));
    expect(saved.groups[2]).toEqual(expect.objectContaining({ id: "g2", order: 2 }));
  });
});
