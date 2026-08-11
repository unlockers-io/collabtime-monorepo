import { Redis } from "ioredis";

const TEAM_ACTIVE_TTL_SECONDS = 60 * 60 * 24 * 365 * 2;
const SCAN_COUNT = 200;

const main = async () => {
  const url = process.env.REDIS_URL;
  if (url === undefined || url === "") {
    throw new Error("REDIS_URL is not set");
  }

  const dryRun = process.argv.includes("--dry-run");
  const redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });

  let cursor = "0";
  let scanned = 0;
  let refreshed = 0;
  let shortest = Number.POSITIVE_INFINITY;

  try {
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "team:*", "COUNT", SCAN_COUNT);
      cursor = nextCursor;
      scanned += keys.length;

      const ttls = await Promise.all(keys.map((key) => redis.ttl(key)));

      for (const [index, ttl] of ttls.entries()) {
        const key = keys[index];
        if (key === undefined) {
          continue;
        }
        if (ttl < 0 || ttl >= TEAM_ACTIVE_TTL_SECONDS) {
          continue;
        }
        shortest = Math.min(shortest, ttl);
        if (!dryRun) {
          await redis.expire(key, TEAM_ACTIVE_TTL_SECONDS);
        }
        refreshed += 1;
      }
    } while (cursor !== "0");
  } finally {
    await redis.quit();
  }

  const days = shortest === Number.POSITIVE_INFINITY ? "n/a" : (shortest / 86_400).toFixed(1);
  console.log(
    `${dryRun ? "[dry-run] " : ""}scanned ${scanned} team keys, ${refreshed} extended, closest expiry was ${days} days out`,
  );
};

await main();
