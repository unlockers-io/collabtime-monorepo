import { assert, describe, expect, it, vi } from "vitest";

import type { TeamRecord } from "@/types";

import {
  createTestMember,
  createTestTeamRecord,
  VALID_UUID,
  VALID_UUID_2,
  VALID_UUID_3,
} from "./actions/test-helpers";
import { teamCommands } from "./team-commands";
import { createMemoryTeamStorage } from "./team-memory-storage";
import type { TeamStorage } from "./team-storage";
import { createTeamStore, teamNameTag, type TeamStoreDeps } from "./team-store";

const setup = (overrides: (memory: TeamStorage) => Partial<TeamStorage> = () => ({})) => {
  const memory = createMemoryTeamStorage();
  const storage: TeamStorage = {
    compareAndSet: vi.fn(memory.compareAndSet),
    mirror: vi.fn(memory.mirror),
    publish: vi.fn(memory.publish),
    readContents: vi.fn(memory.readContents),
    readContentsBatch: vi.fn(memory.readContentsBatch),
    ...overrides(memory),
  };
  let issued = 0;
  const invalidateTeamName = vi.fn<TeamStoreDeps["invalidateTeamName"]>();
  const reportError = vi.fn<TeamStoreDeps["reportError"]>();
  const store = createTeamStore({
    createId: () => {
      issued += 1;
      return `00000000-0000-4000-8000-${String(issued).padStart(12, "0")}`;
    },
    invalidateTeamName,
    reportError,
    storage,
  });
  const seed = (contents: string) => memory.compareAndSet(VALID_UUID, null, contents);

  return { invalidateTeamName, memory, reportError, seed, storage, store };
};

const memberAdded = (name: string) =>
  teamCommands.addMember({
    name,
    timezone: "Europe/Berlin",
    title: "",
    workingHoursEnd: 17,
    workingHoursStart: 9,
  });

describe("readTeamRecord", () => {
  it("returns null for an invalid UUID without reading storage", async () => {
    const { storage, store } = setup();

    expect(await store.readTeamRecord("not-a-uuid")).toBeNull();
    expect(storage.readContents).not.toHaveBeenCalled();
  });

  it("reads a stored team and backfills missing arrays and member order", async () => {
    const { seed, store } = setup();
    await seed(
      JSON.stringify({
        ...createTestTeamRecord(),
        groups: undefined,
        members: [{ ...createTestMember(), order: undefined }],
      }),
    );

    const record = await store.readTeamRecord(VALID_UUID);

    expect(record?.groups).toEqual([]);
    expect(record?.members[0]?.order).toBe(0);
  });

  it("reads a member whose group no longer exists as ungrouped", async () => {
    const { seed, store } = setup();
    const orphan = createTestMember({ groupId: VALID_UUID_2 });
    await seed(JSON.stringify(createTestTeamRecord({ members: [orphan] })));

    const record = await store.readTeamRecord(VALID_UUID);
    expect(record?.members[0]?.groupId).toBeUndefined();
  });

  it("returns null and reports when storage cannot be read", async () => {
    const { reportError, store } = setup(() => ({
      readContents: () => Promise.reject(new Error("connection failed")),
    }));

    expect(await store.readTeamRecord(VALID_UUID)).toBeNull();
    expect(reportError).toHaveBeenCalledOnce();
  });

  it("still reads a legacy blob the schema rejects", async () => {
    const { seed, store } = setup();
    await seed(
      JSON.stringify({
        ...createTestTeamRecord(),
        createdAt: undefined,
        members: [{ ...createTestMember(), title: undefined }],
      }),
    );

    const record = await store.readTeamRecord(VALID_UUID);

    expect(record?.name).toBe("Test Team");
    expect(record?.members[0]).toMatchObject({ name: "Alice", order: 0 });
  });

  it("keeps unrecognised keys on a rescued blob so a write does not erase them", async () => {
    const { seed, store } = setup();
    const { name: _, ...legacyTeam } = createTestTeamRecord();
    await seed(JSON.stringify({ ...legacyTeam, futureField: "keep me" }));

    expect(await store.readTeamRecord(VALID_UUID)).toMatchObject({
      futureField: "keep me",
      name: "",
    });
  });

  it("returns null when the blob holds no fields to read", async () => {
    const { seed, store } = setup();
    await seed("42");

    expect(await store.readTeamRecord(VALID_UUID)).toBeNull();
  });
});

describe("readTeamSummaries", () => {
  it("reads current summaries together in one batch of canonical contents", async () => {
    const { storage, store } = setup();
    await store.createTeamContents(
      VALID_UUID,
      createTestTeamRecord({ members: [createTestMember()], name: "First" }),
    );
    await store.createTeamContents(
      VALID_UUID_2,
      createTestTeamRecord({ id: VALID_UUID_2, name: "Second" }),
    );

    expect(
      await store.readTeamSummaries([VALID_UUID_2, VALID_UUID, VALID_UUID_2, "invalid"]),
    ).toEqual(
      new Map([
        [VALID_UUID_2, { memberCount: 0, name: "Second" }],
        [VALID_UUID, { memberCount: 1, name: "First" }],
      ]),
    );
    expect(storage.readContentsBatch).toHaveBeenCalledExactlyOnceWith([VALID_UUID_2, VALID_UUID]);
    expect(storage.readContents).not.toHaveBeenCalled();
  });

  it("serves current contents after a failed mirror and a later successful write", async () => {
    const { reportError, storage, store } = setup((memory) => ({
      mirror: vi
        .fn(memory.mirror)
        .mockImplementationOnce(memory.mirror)
        .mockRejectedValueOnce(new Error("postgres down")),
    }));
    await store.createTeamContents(VALID_UUID, createTestTeamRecord({ name: "Before" }));
    await store.applyTeamCommand(VALID_UUID, teamCommands.renameTeam("After"));

    expect(reportError).toHaveBeenCalledOnce();
    expect(await store.readTeamSummary(VALID_UUID)).toEqual({ memberCount: 0, name: "After" });

    await store.applyTeamCommand(VALID_UUID, memberAdded("Ada"));
    vi.mocked(storage.readContents).mockClear();

    expect(await store.readTeamSummary(VALID_UUID)).toEqual({ memberCount: 1, name: "After" });
    expect(storage.readContents).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "ignores a delayed stale mirror even when it fails after writing: %s",
    async (failAfterWrite) => {
      const paused = Promise.withResolvers<undefined>();
      const resume = Promise.withResolvers<undefined>();
      const mirrored = new Map<string, TeamRecord>();
      const { reportError, seed, store } = setup(() => ({
        mirror: async (teamId, team) => {
          if (team.name === "Old") {
            paused.resolve(undefined);
            await resume.promise;
          }
          mirrored.set(teamId, team);
          if (team.name === "Old" && failAfterWrite) {
            throw new Error("failed after Postgres commit");
          }
        },
      }));
      await seed(JSON.stringify(createTestTeamRecord()));
      const old = store.applyTeamCommand(VALID_UUID, teamCommands.renameTeam("Old"));
      await paused.promise;
      try {
        expect(
          await store.applyTeamCommand(VALID_UUID, teamCommands.renameTeam("New")),
        ).toMatchObject({ ok: true });
        expect(await store.applyTeamCommand(VALID_UUID, memberAdded("Ada"))).toMatchObject({
          ok: true,
        });
        expect(mirrored.get(VALID_UUID)?.name).toBe("New");
        expect(await store.readTeamSummary(VALID_UUID)).toEqual({ memberCount: 1, name: "New" });
      } finally {
        resume.resolve(undefined);
        await old;
      }

      expect(mirrored.get(VALID_UUID)?.name).toBe("Old");
      expect(await store.readTeamSummary(VALID_UUID)).toEqual({ memberCount: 1, name: "New" });
      expect(reportError).toHaveBeenCalledTimes(failAfterWrite ? 1 : 0);
    },
  );

  it("serves the contents even when the mirror was never filled", async () => {
    const { memory, seed, store } = setup();
    const team = createTestTeamRecord({ members: [createTestMember()] });
    await seed(JSON.stringify(team));
    await memory.mirror(VALID_UUID, createTestTeamRecord({ name: "" }));

    expect(await store.readTeamSummary(VALID_UUID)).toEqual({ memberCount: 1, name: team.name });
  });

  it("summarises contents stored without a members array or matching schema", async () => {
    const { seed, store } = setup();
    await seed(
      JSON.stringify({ ...createTestTeamRecord(), createdAt: undefined, members: undefined }),
    );

    expect(await store.readTeamSummary(VALID_UUID)).toEqual({ memberCount: 0, name: "Test Team" });
  });

  it("omits missing or corrupt teams without losing valid summaries in the batch", async () => {
    const { seed, store } = setup();
    await seed("not json");
    await store.createTeamContents(VALID_UUID_2, createTestTeamRecord({ id: VALID_UUID_2 }));

    const summaries = await store.readTeamSummaries([VALID_UUID, VALID_UUID_2, VALID_UUID_3]);

    expect(summaries).toEqual(new Map([[VALID_UUID_2, { memberCount: 0, name: "Test Team" }]]));
  });

  it("propagates a canonical read failure even after a successful mirror", async () => {
    const error = new Error("Redis unavailable");
    const { store } = setup(() => ({ readContentsBatch: () => Promise.reject(error) }));
    await store.createTeamContents(VALID_UUID, createTestTeamRecord());

    await expect(store.readTeamSummaries([VALID_UUID])).rejects.toBe(error);
    await expect(store.readTeamSummary(VALID_UUID)).rejects.toBe(error);
  });

  it("skips the batch when none of the requested IDs is valid", async () => {
    const { storage, store } = setup();

    expect(await store.readTeamSummaries(["not-a-uuid"])).toEqual(new Map());
    expect(storage.readContentsBatch).not.toHaveBeenCalled();
  });
});

describe("applyTeamCommand", () => {
  it("commits the change, then publishes, and returns the team with the command value", async () => {
    const { storage, store } = setup();
    await store.createTeamContents(VALID_UUID, createTestTeamRecord());
    vi.mocked(storage.publish).mockClear();

    const result = await store.applyTeamCommand(VALID_UUID, memberAdded("Ada"));

    assert(result.ok, "expected the command to commit");
    expect(result.value.name).toBe("Ada");
    expect(result.team.members).toEqual([result.value]);
    const record = await store.readTeamRecord(VALID_UUID);
    expect(record?.members).toEqual([result.value]);
    expect(storage.publish).toHaveBeenCalledExactlyOnceWith(VALID_UUID);
    expect(storage.compareAndSet).toHaveBeenCalledBefore(vi.mocked(storage.publish));
  });

  it("rejects without writing when the command refuses", async () => {
    const { storage, store } = setup();
    await store.createTeamContents(VALID_UUID, createTestTeamRecord());
    vi.mocked(storage.compareAndSet).mockClear();

    expect(
      await store.applyTeamCommand(VALID_UUID, teamCommands.removeMember("missing", undefined)),
    ).toEqual({
      error: "Member not found",
      ok: false,
      reason: "rejected",
    });
    expect(storage.compareAndSet).not.toHaveBeenCalled();
  });

  it("refuses a team with no contents", async () => {
    const { store } = setup();

    expect(await store.applyTeamCommand(VALID_UUID, teamCommands.renameTeam("Team"))).toEqual({
      error: "Team not found",
      ok: false,
      reason: "rejected",
    });
  });

  it("reports a failed read rather than passing it off as a missing team", async () => {
    const { store } = setup(() => ({
      readContents: () => Promise.reject(new Error("connection failed")),
    }));
    const command = vi.fn(teamCommands.renameTeam("Team"));

    expect(await store.applyTeamCommand(VALID_UUID, command)).toEqual({
      error: "Could not read the team",
      ok: false,
      reason: "read-failed",
    });
    expect(command).not.toHaveBeenCalled();
  });

  it("reports a failed write and never publishes it", async () => {
    const { memory, seed, storage, store } = setup(() => ({
      compareAndSet: () => Promise.reject(new Error("connection failed")),
    }));
    await seed(JSON.stringify(createTestTeamRecord()));

    expect(await store.applyTeamCommand(VALID_UUID, teamCommands.renameTeam("Team"))).toEqual({
      error: "Failed to save the team",
      ok: false,
      reason: "write-failed",
    });
    expect(storage.publish).not.toHaveBeenCalled();
    expect(await memory.readContents(VALID_UUID)).toBe(JSON.stringify(createTestTeamRecord()));
  });

  it("skips the write when the command changes nothing", async () => {
    const { storage, store } = setup();
    await store.createTeamContents(VALID_UUID, createTestTeamRecord());
    vi.mocked(storage.compareAndSet).mockClear();
    vi.mocked(storage.publish).mockClear();

    const result = await store.applyTeamCommand(VALID_UUID, teamCommands.renameTeam("Test Team"));

    expect(result).toMatchObject({ ok: true });
    expect(storage.compareAndSet).not.toHaveBeenCalled();
    expect(storage.publish).not.toHaveBeenCalled();
  });

  it("keeps both of two concurrent writes to the same team", async () => {
    const { storage, store } = setup();
    await store.createTeamContents(VALID_UUID, createTestTeamRecord());
    vi.mocked(storage.compareAndSet).mockClear();
    vi.mocked(storage.publish).mockClear();
    vi.mocked(storage.mirror).mockClear();

    const results = await Promise.all([
      store.applyTeamCommand(VALID_UUID, memberAdded("Ada")),
      store.applyTeamCommand(VALID_UUID, memberAdded("Grace")),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    expect(storage.compareAndSet).toHaveBeenCalledTimes(3);
    expect(storage.publish).toHaveBeenCalledTimes(2);
    expect(storage.mirror).toHaveBeenCalledTimes(2);
    const record = await store.readTeamRecord(VALID_UUID);
    expect(record?.members.map((member) => [member.name, member.order])).toEqual([
      ["Ada", 0],
      ["Grace", 1],
    ]);
  });

  it("gives up with a conflict when the contents keep changing", async () => {
    const { seed, store } = setup(() => ({ compareAndSet: () => Promise.resolve(false) }));
    await seed(JSON.stringify(createTestTeamRecord()));

    expect(await store.applyTeamCommand(VALID_UUID, teamCommands.renameTeam("Team"))).toEqual({
      error: "This workspace changed while saving. Try again.",
      ok: false,
      reason: "conflict",
    });
  });

  it("still publishes and succeeds when the mirror write fails", async () => {
    const { reportError, storage, store } = setup(() => ({
      mirror: () => Promise.reject(new Error("postgres down")),
    }));
    await store.createTeamContents(VALID_UUID, createTestTeamRecord());

    const result = await store.applyTeamCommand(VALID_UUID, teamCommands.renameTeam("Renamed"));

    expect(result.ok).toBe(true);
    expect(storage.publish).toHaveBeenCalledTimes(2);
    expect(reportError).toHaveBeenCalledTimes(2);
  });

  it("invalidates the cached name once when the name changes, and only then", async () => {
    const { invalidateTeamName, store } = setup();
    await store.createTeamContents(VALID_UUID, createTestTeamRecord());

    await store.applyTeamCommand(VALID_UUID, memberAdded("Ada"));
    await store.applyTeamCommand(VALID_UUID, teamCommands.renameTeam("Test Team"));
    expect(invalidateTeamName).not.toHaveBeenCalled();

    await store.applyTeamCommand(VALID_UUID, teamCommands.renameTeam("Renamed"));
    expect(invalidateTeamName).toHaveBeenCalledExactlyOnceWith(VALID_UUID);
  });

  it("keys the cached name on the team id", () => {
    expect(teamNameTag("abc")).toBe("team-name:abc");
    expect(teamNameTag("abc")).not.toBe(teamNameTag("def"));
  });
});

describe("createTeamContents", () => {
  it("refuses to overwrite existing contents", async () => {
    const { store } = setup();
    await store.createTeamContents(VALID_UUID, createTestTeamRecord({ name: "First" }));

    expect(
      await store.createTeamContents(VALID_UUID, createTestTeamRecord({ name: "Second" })),
    ).toEqual({ error: "Team already exists", ok: false, reason: "rejected" });
    const record = await store.readTeamRecord(VALID_UUID);
    expect(record?.name).toBe("First");
  });
});
