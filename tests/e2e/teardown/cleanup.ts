import { Redis } from "ioredis";

const cleanup = async () => {
  const url = process.env.REDIS_URL;

  if (!url) {
    return;
  }

  const redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });

  try {
    let cursor = "0";
    const keysToDelete: Array<string> = [];

    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "team:*", "COUNT", 100);
      cursor = nextCursor;

      const entries = await Promise.all(
        keys.map(async (key) => ({ key, value: await redis.get(key) })),
      );
      for (const { key, value } of entries) {
        if (value?.includes("e2e-test@collabtime")) {
          keysToDelete.push(key);
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
