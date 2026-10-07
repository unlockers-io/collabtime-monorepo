// @vitest-environment node
import { randomUUID } from "node:crypto";

import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestMember, createTestTeamRecord } from "./actions/test-helpers";
import { redis } from "./redis";
import { COMPARE_AND_SET, redisTeamStorage } from "./team-storage";
import { createTeamStore } from "./team-store";

const url = process.env.REDIS_URL;

describe.skipIf(url === undefined || url === "")("team storage against Redis", () => {
  let client: Redis;
  const keys: Array<string> = [];
  const key = () => {
    const value = `test:team-contents:${randomUUID()}`;
    keys.push(value);
    return value;
  };
  const compareAndSet = async (contents: string, expected: string, next: string) =>
    Number(await client.eval(COMPARE_AND_SET, 1, contents, expected, next, 600));

  beforeAll(() => {
    client = new Redis(url ?? "", { maxRetriesPerRequest: 1 });
  });
  afterAll(async () => {
    if (keys.length > 0) {
      await client.del(...keys);
    }
    await client.quit();
    await redis.quit();
  });

  it("writes only over the contents it read", async () => {
    const team = key();

    expect(await compareAndSet(team, "", "v1")).toBe(1);
    expect(await compareAndSet(team, "", "v2")).toBe(0);
    expect(await compareAndSet(team, "v1", "v2")).toBe(1);

    expect(await client.get(team)).toBe("v2");
    expect(await client.ttl(team)).toBeGreaterThan(500);
  });

  it("treats empty contents as absent", async () => {
    const team = key();
    await client.set(team, "");

    expect(await compareAndSet(team, "", "v1")).toBe(1);
  });

  it("lets exactly one of many writers holding the same read commit", async () => {
    const team = key();
    await client.set(team, "base");

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) => compareAndSet(team, "base", `v${index}`)),
    );

    const winner = results.indexOf(1);
    expect(results.filter((result) => result === 1)).toHaveLength(1);
    expect(await client.get(team)).toBe(`v${winner}`);
  });

  it("batch-reads canonical contents in request order, refreshing only present teams", async () => {
    const first = randomUUID();
    const second = randomUUID();
    const empty = randomUUID();
    const missing = randomUUID();
    keys.push(...[first, second, empty, missing].map((id) => `team:${id}`));
    await client.mset(`team:${first}`, "first", `team:${second}`, "second", `team:${empty}`, "");

    expect(await redisTeamStorage.readContentsBatch([second, missing, first, empty])).toEqual([
      "second",
      null,
      "first",
      null,
    ]);
    expect(await client.ttl(`team:${first}`)).toBeGreaterThan(60 * 60 * 24 * 365);
    expect(await client.ttl(`team:${second}`)).toBeGreaterThan(60 * 60 * 24 * 365);
    expect(await client.ttl(`team:${empty}`)).toBe(-1);
    expect(await client.exists(`team:${missing}`)).toBe(0);
    expect(await redisTeamStorage.readContentsBatch([])).toEqual([]);
  });

  it("serves batched summaries from canonical Redis without Postgres or mirror markers", async () => {
    const first = randomUUID();
    const second = randomUUID();
    keys.push(`team:${first}`, `team:${second}`, `team-mirror:${first}`);
    const team = createTestTeamRecord({
      id: first,
      members: [createTestMember()],
      name: "Current",
    });
    await client.mset(
      `team:${first}`,
      JSON.stringify(team),
      `team:${second}`,
      JSON.stringify(createTestTeamRecord({ id: second, name: "Other" })),
      `team-mirror:${first}`,
      "stale",
    );
    const store = createTeamStore({
      createId: randomUUID,
      invalidateTeamName: vi.fn<() => void>(),
      reportError: vi.fn<() => void>(),
      storage: redisTeamStorage,
    });

    expect(await store.readTeamSummaries([first, second, first])).toEqual(
      new Map([
        [first, { memberCount: 1, name: "Current" }],
        [second, { memberCount: 0, name: "Other" }],
      ]),
    );
  });

  it("creates contents with the initial TTL and extends it on every read", async () => {
    const teamId = randomUUID();
    keys.push(`team:${teamId}`);

    expect(await redisTeamStorage.compareAndSet(teamId, null, "v1")).toBe(true);
    expect(await client.ttl(`team:${teamId}`)).toBeLessThanOrEqual(60 * 60 * 24 * 60);

    expect(await redisTeamStorage.readContents(teamId)).toBe("v1");
    expect(await client.ttl(`team:${teamId}`)).toBeGreaterThan(60 * 60 * 24 * 365);

    await client.set(`team:${teamId}`, "");
    expect(await redisTeamStorage.readContents(teamId)).toBeNull();
    expect(await redisTeamStorage.readContents(randomUUID())).toBeNull();
  });
});
