import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRateLimiter } from "./space-rate-limit";

type Entry = { count: number; expiresAt: number | null };

const store = new Map<string, Entry>();
let redisPresent = true;

const evalScript = (key: string, windowSeconds: number): number => {
  const now = Date.now();
  const existing = store.get(key);
  if (existing && existing.expiresAt !== null && now > existing.expiresAt) {
    store.delete(key);
  }
  const entry = store.get(key) ?? { count: 0, expiresAt: null };
  entry.count += 1;
  if (entry.count === 1) {
    entry.expiresAt = now + windowSeconds * 1000;
  }
  store.set(key, entry);
  return entry.count;
};

const incrementMock = vi.fn((key: string, windowSeconds: number): Promise<number> =>
  Promise.resolve(evalScript(key, windowSeconds)),
);
const checkRateLimit = createRateLimiter({
  increment: incrementMock,
  isRedisConfigured: () => redisPresent,
});

type Result = Awaited<ReturnType<typeof checkRateLimit>>;

const runSequential = async (
  times: number,
  run: () => Promise<Result>,
  acc: Array<Result> = [],
): Promise<Array<Result>> => {
  if (times <= 0) {
    return acc;
  }
  const result = await run();
  return runSequential(times - 1, run, [...acc, result]);
};

describe("checkRateLimit", () => {
  beforeEach(() => {
    store.clear();
    redisPresent = true;
    incrementMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first N attempts then blocks N+1", async () => {
    const max = 5;
    const results = await runSequential(max + 1, () => checkRateLimit("key-a", max, 60));
    const blocked = results[max];

    expect(results.slice(0, max).every((r) => r.allowed)).toBe(true);
    expect(blocked?.allowed).toBe(false);
    expect(blocked?.remaining).toBe(0);
  });

  it("decrements remaining correctly", async () => {
    const max = 3;
    const results = await runSequential(max, () => checkRateLimit("key-b", max, 60));

    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0]);
  });

  it("is atomic under concurrency: exactly `max` allowed in a burst", async () => {
    const max = 10;
    const results = await Promise.all(
      Array.from({ length: max + 5 }, () => checkRateLimit("key-c", max, 60)),
    );
    const allowed = results.filter((r) => r.allowed).length;
    const blocked = results.filter((r) => !r.allowed).length;
    expect(allowed).toBe(max);
    expect(blocked).toBe(5);
  });

  it("resets the window after the TTL expires", async () => {
    vi.useFakeTimers();
    const max = 2;
    const firstWindow = await runSequential(max + 1, () => checkRateLimit("key-d", max, 60));
    expect(firstWindow[max]?.allowed).toBe(false);

    vi.advanceTimersByTime(61 * 1000);

    const afterReset = await checkRateLimit("key-d", max, 60);
    expect(afterReset.allowed).toBe(true);
  });

  it("degrades OPEN when Redis is unconfigured", async () => {
    redisPresent = false;

    const results = await runSequential(20, () => checkRateLimit("key-e", 5, 60));

    expect(results.every((r) => r.allowed)).toBe(true);
    expect(incrementMock).not.toHaveBeenCalled();
  });

  it("issues one Redis op per check, not a probe followed by the script", async () => {
    await checkRateLimit("key-f", 5, 60);

    expect(incrementMock).toHaveBeenCalledTimes(1);
  });
});
