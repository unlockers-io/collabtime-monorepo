import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkUuid, sanitizeTeam } from "./helpers";
import {
  createTestAccess,
  createTestMember,
  createTestTeamMutator,
  createTestTeamRecord,
  VALID_UUID,
} from "./test-helpers";

const testMutator = createTestTeamMutator();
const { mutateTeam } = testMutator;
const access = createTestAccess();
const continueMutation = () => ({ ok: true as const, value: undefined });

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
    testMutator.reset();
  });

  it("short-circuits on prelude failure before load", async () => {
    const mutate = vi.fn();

    const result = await mutateTeam({
      access,
      errorContext: "do thing",
      mutate,
      prelude: () => ({ error: "Bad input", ok: false }),
    });

    expect(result).toEqual({ error: "Bad input", success: false });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("converts thrown prelude errors to 'Failed to <errorContext>'", async () => {
    const result = await mutateTeam({
      access,
      errorContext: "remove widget",
      mutate: () => ({ ok: true, value: 1 }),
      prelude: () => Promise.reject(new Error("Database unavailable")),
    });

    expect(result).toEqual({ error: "Failed to remove widget", success: false });
    expect(testMutator.reportError).toHaveBeenCalledOnce();
  });

  it("returns 'Team not found' when redis has no team", async () => {
    testMutator.seedTeam(null);
    const mutate = vi.fn();

    const result = await mutateTeam({
      access,
      errorContext: "do thing",
      mutate,
      prelude: continueMutation,
    });

    expect(result).toEqual({ error: "Team not found", success: false });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("passes prelude value into mutate and persists on success", async () => {
    const team = createTestTeamRecord();
    testMutator.seedTeam(team);

    const result = await mutateTeam({
      access,
      errorContext: "do thing",
      mutate: (loaded, payload) => {
        loaded.name = payload;
        return { ok: true, value: payload };
      },
      prelude: () => ({ ok: true, value: "Renamed" }),
    });

    expect(result).toEqual({ data: "Renamed", success: true });
    expect(testMutator.persistedTeam()?.name).toBe("Renamed");
  });

  it("does not persist when mutate returns a domain error", async () => {
    const team = createTestTeamRecord();
    testMutator.seedTeam(team);

    const result = await mutateTeam({
      access,
      errorContext: "do thing",
      mutate: () => ({ error: "Item not found", ok: false }),
      prelude: continueMutation,
    });

    expect(result).toEqual({ error: "Item not found", success: false });
    expect(testMutator.persistedTeam()).toEqual(team);
  });

  it("supports async preludes", async () => {
    testMutator.seedTeam(createTestTeamRecord());

    const result = await mutateTeam({
      access,
      errorContext: "do thing",
      mutate: (_team, payload) => ({ ok: true, value: payload }),
      prelude: () => Promise.resolve({ ok: true as const, value: 42 }),
    });

    expect(result).toEqual({ data: 42, success: true });
  });
});
