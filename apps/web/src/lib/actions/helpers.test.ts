import { assert, beforeEach, describe, expect, it, vi } from "vitest";

import { teamCommands } from "../team-commands";
import { createMemoryTeamStorage } from "../team-memory-storage";
import { createTeamStore } from "../team-store";
import { TeamNameSchema } from "../validation";

import { createTeamMutator, invalidUuid, parsedInput, sanitizeTeam } from "./helpers";
import {
  createTestAccess,
  createTestMember,
  createTestTeamRecord,
  createTestTeamStore,
  VALID_UUID,
} from "./test-helpers";

const access = createTestAccess();

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
    expect(result.members[0]?.userId).toBe("user-123");
  });

  it("replaces other users' userIds with 'claimed'", () => {
    const team = createTestTeamRecord({
      members: [createTestMember({ userId: "other-user" })],
    });

    const result = sanitizeTeam(team, "user-123");
    expect(result.members[0]?.userId).toBe("claimed");
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

describe("invalidUuid", () => {
  it("passes a valid UUID", () => {
    expect(invalidUuid(VALID_UUID, "team ID")).toBeNull();
  });

  it("returns a labelled failure for an invalid UUID", () => {
    expect(invalidUuid("not-a-uuid", "member ID")).toEqual({
      error: "Invalid member ID",
      success: false,
    });
  });
});

describe("parsedInput", () => {
  it("returns the parsed data or the first issue", () => {
    expect(parsedInput(TeamNameSchema.safeParse("  Team  "), "Invalid")).toEqual({
      data: "Team",
      success: true,
    });
    expect(parsedInput(TeamNameSchema.safeParse("   "), "Invalid")).toEqual({
      error: "Workspace name is required",
      success: false,
    });
  });
});

describe("mutateTeam", () => {
  const harness = createTestTeamStore();
  const { mutateTeam } = harness;

  beforeEach(() => {
    harness.reset();
  });

  it("returns 'Team not found' when the team has no contents", async () => {
    const result = await mutateTeam({
      access,
      command: teamCommands.renameTeam("Renamed"),
      errorContext: "do thing",
    });

    expect(result).toEqual({ error: "Team not found", success: false });
  });

  it("persists the command and returns the committed team with its value", async () => {
    await harness.seedTeam(createTestTeamRecord());

    const result = await mutateTeam({
      access,
      command: teamCommands.addGroup("Design"),
      errorContext: "do thing",
    });

    assert(result.success, "expected the command to commit");
    expect(result.data.value).toEqual({ id: "test-uuid", name: "Design", order: 0 });
    expect(result.data.team.groups).toEqual([result.data.value]);
    const stored = await harness.readTeam();
    expect(stored?.groups).toEqual([result.data.value]);
  });

  it("does not persist when the command rejects", async () => {
    const team = createTestTeamRecord();
    await harness.seedTeam(team);

    const result = await mutateTeam({
      access,
      command: teamCommands.removeMember("missing"),
      errorContext: "do thing",
    });

    expect(result).toEqual({ error: "Member not found", success: false });
    expect(await harness.readTeam()).toEqual(team);
  });

  it("names the action when the write fails", async () => {
    const storage = createMemoryTeamStorage();

    const store = createTeamStore({
      createId: () => VALID_UUID,
      invalidateTeamName: vi.fn<() => void>(),
      reportError: vi.fn<() => void>(),
      storage: {
        ...storage,
        write: () => Promise.reject(new Error("Postgres unavailable")),
      },
    });

    await storage.write(VALID_UUID, createTestTeamRecord(), undefined);

    const failingMutate = createTeamMutator({
      applyTeamCommand: store.applyTeamCommand,
      reportError: vi.fn<() => void>(),
    });

    const result = await failingMutate({
      access,
      command: teamCommands.renameTeam("Renamed"),
      errorContext: "rename widget",
    });

    expect(result).toEqual({ error: "Failed to rename widget", success: false });
  });

  it("converts an unexpected throw into 'Failed to <errorContext>'", async () => {
    const reportError = vi.fn<() => void>();

    const throwingMutate = createTeamMutator({
      applyTeamCommand: () => Promise.reject(new Error("Database unavailable")),
      reportError,
    });

    const result = await throwingMutate({
      access,
      command: teamCommands.renameTeam("Renamed"),
      errorContext: "remove widget",
    });

    expect(result).toEqual({ error: "Failed to remove widget", success: false });
    expect(reportError).toHaveBeenCalledOnce();
  });
});
