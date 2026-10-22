// @vitest-environment node
import { randomUUID } from "node:crypto";

import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ACQUIRE_LEASE, LEASE_SECONDS } from "./team-event-admission";

const url = process.env.LIVE_SYNC_TEST_REDIS_URL;

describe.skipIf(url === undefined || url === "")("live sync leases against Redis", () => {
  let client: Redis;
  const keys: Array<string> = [];

  const key = () => {
    const value = `test:live-sync:${randomUUID()}`;
    keys.push(value);

    return value;
  };

  const acquire = async (leaseKey: string, id: string, limit: number) =>
    Number(await client.eval(ACQUIRE_LEASE, 1, leaseKey, id, limit, LEASE_SECONDS));

  beforeAll(() => {
    client = new Redis(url!, { maxRetriesPerRequest: 1 });
  });
  afterAll(async () => {
    if (keys.length > 0) {
      await client.del(...keys);
    }

    await client.quit();
  });

  it("admits exactly the cap under concurrent acquisition", async () => {
    const leaseKey = key();

    const admitted = await Promise.all(
      Array.from({ length: 30 }, (_, index) => acquire(leaseKey, `connection-${index}`, 10)),
    );

    expect(admitted.filter(Boolean)).toHaveLength(10);
    expect(await client.zcard(leaseKey)).toBe(10);
    expect(await client.ttl(leaseKey)).toBeGreaterThan(350);
  });

  it("prunes expired leases without losing newer generations or extending old leases", async () => {
    const leaseKey = key();
    await acquire(leaseKey, "old", 2);
    const oldExpiry = await client.zscore(leaseKey, "old");
    await acquire(leaseKey, "active", 2);
    expect(await client.zscore(leaseKey, "old")).toBe(oldExpiry);
    expect(await acquire(leaseKey, "blocked", 2)).toBe(0);
    await client.zadd(leaseKey, "0", "old");
    expect(await acquire(leaseKey, "new", 2)).toBe(1);
    await client.zrem(leaseKey, "old");
    expect(await client.zrange(leaseKey, "0", "-1")).toEqual(
      expect.arrayContaining(["active", "new"]),
    );
    expect(await acquire(leaseKey, "still-blocked", 2)).toBe(0);
  });

  it("does not let cleanup from an expired key delete a replacement connection", async () => {
    const leaseKey = key();
    await acquire(leaseKey, "dead-function", 1);
    await client.pexpire(leaseKey, 0);
    expect(await acquire(leaseKey, "replacement", 1)).toBe(1);
    await client.zrem(leaseKey, "dead-function");
    expect(await client.zcard(leaseKey)).toBe(1);
    expect(await acquire(leaseKey, "blocked", 1)).toBe(0);
  });
});
