import { Redis } from "@upstash/redis";

const cleanup = async () => {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return;
    }

    const redis = new Redis({ token, url });

    // Find and delete all Redis keys created by E2E tests.
    // Test teams use UUIDs as teamIds, stored as team:<uuid> keys.
    // We scan for keys matching "team:*" that were created during E2E runs.
    // In CI, the Postgres container is ephemeral so no DB cleanup needed.
    let cursor = "0";
    const keysToDelete: Array<string> = [];

    do {
      // oxlint-disable-next-line no-await-in-loop -- redis scan needs the previous cursor before requesting the next page
      const [nextCursor, keys] = await redis.scan(cursor, { count: 100, match: "team:*" });
      cursor = String(nextCursor);

      // oxlint-disable-next-line no-await-in-loop -- pages are scanned sequentially; values within a page are fetched in parallel
      const values = await Promise.all(keys.map((key) => redis.get(key)));
      for (const [index, value] of values.entries()) {
        // Test teams have no members initially and use "E2E" patterns
        if (value && typeof value === "string" && value.includes("e2e-test@collabtime")) {
          keysToDelete.push(keys[index]);
        }
      }
    } while (cursor !== "0");

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
      // eslint-disable-next-line no-console -- Teardown script needs visible output
      console.log(`[E2E Cleanup] Deleted ${keysToDelete.length} Redis key(s)`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console -- Teardown script needs visible output
    console.error("[E2E Cleanup] Failed to clean up:", error);
  }
};

export default cleanup;
