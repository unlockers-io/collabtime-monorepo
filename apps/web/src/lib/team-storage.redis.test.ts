// @vitest-environment node
import { randomUUID } from "node:crypto";

import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { redis } from "./redis";
import { COMPARE_AND_SET, redisTeamStorage, SETTLE_MIRROR } from "./team-storage";

const url = process.env.REDIS_URL;

describe.skipIf(url === undefined || url === "")("team storage against Redis", () => {
  let client: Redis;
  const keys: Array<string> = [];
  const key = () => {
    const value = `test:team-contents:${randomUUID()}`;
    keys.push(value);
    return value;
  };
  const compareAndSet = async (
    [contents, marker]: [string, string],
    expected: string,
    next: string,
    revision: string,
  ) =>
    Number(
      await client.eval(COMPARE_AND_SET, 2, contents, marker, expected, next, 600, revision, 900),
    );
  const settle = async (marker: string, revision: string) =>
    Number(await client.eval(SETTLE_MIRROR, 1, marker, revision, 900));

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

  it("writes only over the contents it read, and marks that revision unmirrored", async () => {
    const team: [string, string] = [key(), key()];

    expect(await compareAndSet(team, "", "v1", "r1")).toBe(1);
    expect(await compareAndSet(team, "", "v2", "r2")).toBe(0);
    expect(await compareAndSet(team, "v1", "v2", "r2")).toBe(1);

    expect(await client.get(team[0])).toBe("v2");
    expect(await client.get(team[1])).toBe("r2");
    expect(await client.ttl(team[0])).toBeGreaterThan(500);
    expect(await client.ttl(team[1])).toBeGreaterThan(800);
  });

  it("treats empty contents as absent", async () => {
    const team: [string, string] = [key(), key()];
    await client.set(team[0], "");

    expect(await compareAndSet(team, "", "v1", "r1")).toBe(1);
  });

  it("lets exactly one of many writers holding the same read commit", async () => {
    const team: [string, string] = [key(), key()];
    await client.set(team[0], "base");

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        compareAndSet(team, "base", `v${index}`, `r${index}`),
      ),
    );

    const winner = results.indexOf(1);
    expect(results.filter((result) => result === 1)).toHaveLength(1);
    expect(await client.get(team[0])).toBe(`v${winner}`);
    expect(await client.get(team[1])).toBe(`r${winner}`);
  });

  it("settles its own revision and turns any other marker stale", async () => {
    const marker = key();
    await client.set(marker, "r2");

    expect(await settle(marker, "r1")).toBe(0);
    expect(await client.get(marker)).toBe("stale");
    expect(await settle(marker, "r2")).toBe(0);
    expect(await client.get(marker)).toBe("stale");

    await client.set(marker, "r3");
    expect(await settle(marker, "r3")).toBe(1);
    expect(await client.exists(marker)).toBe(0);

    expect(await settle(marker, "r1")).toBe(0);
    expect(await client.get(marker)).toBe("stale");
  });

  it("creates contents with the initial TTL and extends it on every read", async () => {
    const teamId = randomUUID();
    keys.push(`team:${teamId}`, `team-mirror:${teamId}`);

    expect(await redisTeamStorage.compareAndSet(teamId, null, "v1", "r1")).toBe(true);
    expect(await client.ttl(`team:${teamId}`)).toBeLessThanOrEqual(60 * 60 * 24 * 60);

    expect(await redisTeamStorage.readContents(teamId)).toBe("v1");
    expect(await client.ttl(`team:${teamId}`)).toBeGreaterThan(60 * 60 * 24 * 365);

    await client.set(`team:${teamId}`, "");
    expect(await redisTeamStorage.readContents(teamId)).toBeNull();
    expect(await redisTeamStorage.readContents(randomUUID())).toBeNull();
  });
});
