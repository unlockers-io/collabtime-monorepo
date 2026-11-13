// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestMember,
  createTestTeamRecord,
  resetTestDatabase,
  seedTeam,
  VALID_UUID,
  VALID_UUID_2,
} from "./actions/test-helpers";
import { teamCommands } from "./team-commands";
import { postgresTeamStorage, type TeamStorage } from "./team-storage";
import { createTeamStore, teamNameTag } from "./team-store";

const setup = () => {
  const storage = {
    ...postgresTeamStorage,
    publish: vi.fn<TeamStorage["publish"]>().mockResolvedValue(),
    readBatch: vi.fn(postgresTeamStorage.readBatch),
    write: vi.fn(postgresTeamStorage.write),
  };

  const invalidateTeamName = vi.fn<() => void>();
  let issued = 0;

  const store = createTeamStore({
    createId: () => `member-${++issued}`,
    invalidateTeamName,
    storage,
  });

  return { invalidateTeamName, storage, store };
};

beforeEach(resetTestDatabase);

describe("transactional team store", () => {
  it("keeps concurrent edits without retries", async () => {
    const { storage, store } = setup();
    await seedTeam(createTestTeamRecord());

    const results = await Promise.all([
      store.applyTeamCommand(VALID_UUID, teamCommands.addGroup("A")),
      store.applyTeamCommand(VALID_UUID, teamCommands.addGroup("B")),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    const storedTeam = await store.readTeamRecord(VALID_UUID);
    expect(storedTeam?.groups.map((group) => group.name)).toEqual(["A", "B"]);
    expect(storage.write).toHaveBeenCalledTimes(2);
    expect(storage.publish).toHaveBeenCalledTimes(2);
  });
  it("rolls back a write which fails after changing storage, without publishing", async () => {
    const { storage, store } = setup();
    const team = createTestTeamRecord();
    await seedTeam(team);
    const persist = storage.write.getMockImplementation();
    storage.write.mockImplementationOnce(async (...args) => {
      await persist?.(...args);
      throw new Error("connection lost");
    });
    await expect(
      store.applyTeamCommand(VALID_UUID, teamCommands.renameTeam("New")),
    ).rejects.toThrow("connection lost");
    expect(await store.readTeamRecord(VALID_UUID)).toEqual(team);
    expect(storage.publish).not.toHaveBeenCalled();
  });
  it("does not write or publish rejected or unchanged commands", async () => {
    const { storage, store } = setup();
    await seedTeam(createTestTeamRecord());
    storage.write.mockClear();
    expect(
      await store.applyTeamCommand(VALID_UUID, teamCommands.removeMember("missing")),
    ).toMatchObject({ ok: false });
    expect(
      await store.applyTeamCommand(VALID_UUID, teamCommands.renameTeam("Test Team")),
    ).toMatchObject({ ok: true });
    expect(storage.write).not.toHaveBeenCalled();
    expect(storage.publish).not.toHaveBeenCalled();
  });
  it("rejects missing teams", async () => {
    const { store } = setup();
    expect(await store.readTeamRecord("invalid")).toBeNull();
    expect(await store.applyTeamCommand(VALID_UUID, teamCommands.renameTeam("New"))).toMatchObject({
      error: "Team not found",
      ok: false,
    });
  });
  it("batch reads current summaries and propagates storage failures", async () => {
    const { storage, store } = setup();
    await seedTeam(createTestTeamRecord({ members: [createTestMember()] }));
    await seedTeam(createTestTeamRecord({ id: VALID_UUID_2, name: "Other" }));
    expect(
      await store.readTeamSummaries([VALID_UUID_2, VALID_UUID, VALID_UUID, "invalid"]),
    ).toEqual(
      new Map([
        [VALID_UUID_2, { memberCount: 0, name: "Other" }],
        [VALID_UUID, { memberCount: 1, name: "Test Team" }],
      ]),
    );
    storage.readBatch.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(store.readTeamSummary(VALID_UUID)).rejects.toThrow("database unavailable");
    expect(teamNameTag("abc")).toBe("team-name:abc");
  });
});
