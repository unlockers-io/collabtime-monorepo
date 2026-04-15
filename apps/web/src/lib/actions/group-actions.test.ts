import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireTeamAdmin } from "@/lib/team-auth";

import { realtime } from "../realtime";

import { createGroup, removeGroup, reorderGroups, updateGroup } from "./group-actions";
import { getTeamRecord, persistTeam, sanitizeTeam } from "./helpers";
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
vi.mock("../realtime", () => ({
  realtime: { channel: vi.fn(() => ({ emit: vi.fn(() => Promise.resolve()) })) },
}));
vi.mock("./helpers", () => ({
  getTeamRecord: vi.fn(),
  persistTeam: vi.fn(),
  sanitizeTeam: vi.fn((t: unknown) => t),
}));
vi.mock("uuid", () => ({ v4: vi.fn(() => "test-uuid") }));

const mockedRequireTeamAdmin = vi.mocked(requireTeamAdmin);
const mockedGetTeamRecord = vi.mocked(getTeamRecord);
const mockedPersistTeam = vi.mocked(persistTeam);
const mockedRealtimeChannel = vi.mocked(realtime.channel);

describe("createGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireTeamAdmin.mockResolvedValue(undefined as never);
  });

  it("returns error when auth check fails", async () => {
    mockedRequireTeamAdmin.mockRejectedValue(new Error("Unauthorized"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createGroup(VALID_UUID, { name: "Design" });

    expect(result).toEqual({ success: false, error: "Failed to create group" });
    consoleSpy.mockRestore();
  });

  it("returns error when team is not found", async () => {
    mockedGetTeamRecord.mockResolvedValue(null);

    const result = await createGroup(VALID_UUID, { name: "Design" });

    expect(result).toEqual({ success: false, error: "Team not found" });
  });

  it("assigns order based on existing group count", async () => {
    const team = createTestTeamRecord({
      groups: [createTestGroup({ id: "g1", order: 0 }), createTestGroup({ id: "g2", order: 1 })],
    });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await createGroup(VALID_UUID, { name: "Design" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.group.order).toBe(2);
      expect(result.data.group.name).toBe("Design");
      expect(result.data.group.id).toBe("test-uuid");
    }
  });

  it("pushes new group to team groups array", async () => {
    const team = createTestTeamRecord({ groups: [] });
    mockedGetTeamRecord.mockResolvedValue(team);

    await createGroup(VALID_UUID, { name: "Design" });

    expect(team.groups).toHaveLength(1);
    expect(team.groups[0].name).toBe("Design");
  });

  it("calls redis.set and realtime.emit", async () => {
    const team = createTestTeamRecord({ groups: [] });
    mockedGetTeamRecord.mockResolvedValue(team);
    const mockEmit = vi.fn(() => Promise.resolve());
    mockedRealtimeChannel.mockReturnValue({ emit: mockEmit } as never);

    await createGroup(VALID_UUID, { name: "Design" });

    expect(mockedPersistTeam).toHaveBeenCalledWith(VALID_UUID, expect.any(Object));
    expect(mockedRealtimeChannel).toHaveBeenCalledWith(`team-${VALID_UUID}`);
    expect(mockEmit).toHaveBeenCalledWith(
      "team.groupCreated",
      expect.objectContaining({ name: "Design" }),
    );
  });
});

describe("updateGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireTeamAdmin.mockResolvedValue(undefined as never);
  });

  it("returns error when auth check fails", async () => {
    mockedRequireTeamAdmin.mockRejectedValue(new Error("Unauthorized"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await updateGroup(VALID_UUID, VALID_UUID_2, { name: "New Name" });

    expect(result).toEqual({ success: false, error: "Failed to update group" });
    consoleSpy.mockRestore();
  });

  it("returns error when team is not found", async () => {
    mockedGetTeamRecord.mockResolvedValue(null);

    const result = await updateGroup(VALID_UUID, VALID_UUID_2, { name: "New Name" });

    expect(result).toEqual({ success: false, error: "Team not found" });
  });

  it("returns error when group is not found", async () => {
    const team = createTestTeamRecord({ groups: [createTestGroup()] });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await updateGroup(VALID_UUID, VALID_UUID_3, { name: "New Name" });

    expect(result).toEqual({ success: false, error: "Group not found" });
  });

  it("calls redis.set and realtime.emit on success", async () => {
    const group = createTestGroup({ id: VALID_UUID_2, name: "Engineering" });
    const team = createTestTeamRecord({ groups: [group] });
    mockedGetTeamRecord.mockResolvedValue(team);
    const mockEmit = vi.fn(() => Promise.resolve());
    mockedRealtimeChannel.mockReturnValue({ emit: mockEmit } as never);

    const result = await updateGroup(VALID_UUID, VALID_UUID_2, { name: "Product" });

    expect(result.success).toBe(true);
    expect(mockedPersistTeam).toHaveBeenCalled();
    expect(mockEmit).toHaveBeenCalledWith(
      "team.groupUpdated",
      expect.objectContaining({ name: "Product" }),
    );
  });
});

describe("removeGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireTeamAdmin.mockResolvedValue(undefined as never);
  });

  it("returns error when auth check fails", async () => {
    mockedRequireTeamAdmin.mockRejectedValue(new Error("Unauthorized"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await removeGroup(VALID_UUID, VALID_UUID_2);

    expect(result).toEqual({ success: false, error: "Failed to remove group" });
    consoleSpy.mockRestore();
  });

  it("returns error when team is not found", async () => {
    mockedGetTeamRecord.mockResolvedValue(null);

    const result = await removeGroup(VALID_UUID, VALID_UUID_2);

    expect(result).toEqual({ success: false, error: "Team not found" });
  });

  it("returns error when group is not found", async () => {
    const team = createTestTeamRecord({ groups: [createTestGroup({ id: VALID_UUID_3 })] });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await removeGroup(VALID_UUID, VALID_UUID_2);

    expect(result).toEqual({ success: false, error: "Group not found" });
  });

  it("unassigns members belonging to the removed group", async () => {
    const groupId = VALID_UUID_2;
    const team = createTestTeamRecord({
      groups: [createTestGroup({ id: groupId })],
      members: [
        createTestMember({ id: "m1", groupId }),
        createTestMember({ id: "m2", groupId: VALID_UUID_3 }),
        createTestMember({ id: "m3", groupId: undefined }),
      ],
    });
    mockedGetTeamRecord.mockResolvedValue(team);
    vi.mocked(sanitizeTeam).mockImplementation((t: unknown) => t as never);

    const result = await removeGroup(VALID_UUID, groupId);

    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as ReturnType<typeof createTestTeamRecord>;
      const m1 = data.members.find((m) => m.id === "m1");
      const m2 = data.members.find((m) => m.id === "m2");
      const m3 = data.members.find((m) => m.id === "m3");
      expect(m1?.groupId).toBeUndefined();
      expect(m2?.groupId).toBe(VALID_UUID_3);
      expect(m3?.groupId).toBeUndefined();
    }
  });

  it("reindexes remaining group order values", async () => {
    const team = createTestTeamRecord({
      groups: [
        createTestGroup({ id: "g1", name: "A", order: 0 }),
        createTestGroup({ id: VALID_UUID_2, name: "B", order: 1 }),
        createTestGroup({ id: "g3", name: "C", order: 2 }),
      ],
      members: [],
    });
    mockedGetTeamRecord.mockResolvedValue(team);
    vi.mocked(sanitizeTeam).mockImplementation((t: unknown) => t as never);

    const result = await removeGroup(VALID_UUID, VALID_UUID_2);

    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as ReturnType<typeof createTestTeamRecord>;
      expect(data.groups).toHaveLength(2);
      expect(data.groups[0]).toEqual(expect.objectContaining({ id: "g1", order: 0 }));
      expect(data.groups[1]).toEqual(expect.objectContaining({ id: "g3", order: 1 }));
    }
  });

  it("calls redis.set and emits team.groupRemoved", async () => {
    const team = createTestTeamRecord({
      groups: [createTestGroup({ id: VALID_UUID_2 })],
      members: [],
    });
    mockedGetTeamRecord.mockResolvedValue(team);
    const mockEmit = vi.fn(() => Promise.resolve());
    mockedRealtimeChannel.mockReturnValue({ emit: mockEmit } as never);

    await removeGroup(VALID_UUID, VALID_UUID_2);

    expect(mockedPersistTeam).toHaveBeenCalledWith(VALID_UUID, expect.any(Object));
    expect(mockEmit).toHaveBeenCalledWith("team.groupRemoved", { groupId: VALID_UUID_2 });
  });
});

describe("reorderGroups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireTeamAdmin.mockResolvedValue(undefined as never);
  });

  it("returns error when auth check fails", async () => {
    mockedRequireTeamAdmin.mockRejectedValue(new Error("Unauthorized"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await reorderGroups(VALID_UUID, ["g1"]);

    expect(result).toEqual({ success: false, error: "Failed to reorder groups" });
    consoleSpy.mockRestore();
  });

  it("returns error when team is not found", async () => {
    mockedGetTeamRecord.mockResolvedValue(null);

    const result = await reorderGroups(VALID_UUID, ["g1"]);

    expect(result).toEqual({ success: false, error: "Team not found" });
  });

  it("returns error when group IDs do not match existing groups", async () => {
    const team = createTestTeamRecord({
      groups: [createTestGroup({ id: "g1", order: 0 }), createTestGroup({ id: "g2", order: 1 })],
    });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await reorderGroups(VALID_UUID, ["g1", "g3"]);

    expect(result).toEqual({ success: false, error: "Invalid group order" });
  });

  it("returns error when group IDs count mismatches", async () => {
    const team = createTestTeamRecord({
      groups: [createTestGroup({ id: "g1", order: 0 }), createTestGroup({ id: "g2", order: 1 })],
    });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await reorderGroups(VALID_UUID, ["g1"]);

    expect(result).toEqual({ success: false, error: "Invalid group order" });
  });

  it("updates order values based on new positions", async () => {
    const team = createTestTeamRecord({
      groups: [
        createTestGroup({ id: "g1", name: "A", order: 0 }),
        createTestGroup({ id: "g2", name: "B", order: 1 }),
        createTestGroup({ id: "g3", name: "C", order: 2 }),
      ],
    });
    mockedGetTeamRecord.mockResolvedValue(team);

    const result = await reorderGroups(VALID_UUID, ["g3", "g1", "g2"]);

    expect(result.success).toBe(true);
    expect(team.groups[0]).toEqual(expect.objectContaining({ id: "g3", order: 0 }));
    expect(team.groups[1]).toEqual(expect.objectContaining({ id: "g1", order: 1 }));
    expect(team.groups[2]).toEqual(expect.objectContaining({ id: "g2", order: 2 }));
  });

  it("calls redis.set and emits team.groupsReordered", async () => {
    const team = createTestTeamRecord({
      groups: [createTestGroup({ id: "g1", order: 0 }), createTestGroup({ id: "g2", order: 1 })],
    });
    mockedGetTeamRecord.mockResolvedValue(team);
    const mockEmit = vi.fn(() => Promise.resolve());
    mockedRealtimeChannel.mockReturnValue({ emit: mockEmit } as never);

    await reorderGroups(VALID_UUID, ["g2", "g1"]);

    expect(mockedPersistTeam).toHaveBeenCalledWith(VALID_UUID, expect.any(Object));
    expect(mockEmit).toHaveBeenCalledWith("team.groupsReordered", { order: ["g2", "g1"] });
  });
});
