import { Redis } from "ioredis";

const cleanup = async () => {
  const url = process.env.REDIS_URL;

  if (!url) {
    return;
  }

  const redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });

  try {
    // Only delete team:* keys whose payload references the shared e2e test user.
    let cursor = "0";
    const keysToDelete: Array<string> = [];

    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "team:*", "COUNT", 100);
      cursor = nextCursor;

      const values = await Promise.all(keys.map((key) => redis.get(key)));
      for (const [index, value] of values.entries()) {
        if (value && value.includes("e2e-test@collabtime")) {
          keysToDelete.push(keys[index]);
        }
      }
    } while (cursor !== "0");

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
      console.log(`[E2E Cleanup] Deleted ${keysToDelete.length} Redis key(s)`);
    }
  } catch (error) {
    console.error("[E2E Cleanup] Failed to clean up:", error);
  } finally {
    await redis.quit();
  }
};

export default cleanup;
