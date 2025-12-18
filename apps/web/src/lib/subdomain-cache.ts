import { Redis } from "@upstash/redis";

/**
 * Edge-compatible Redis client for subdomain lookups.
 * Uses REST API which works in edge runtime.
 */
const getEdgeRedis = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn("[Subdomain Cache] Redis not configured");
    return null;
  }

  return new Redis({ url, token });
};

type CachedSpace = {
  id: string;
  teamId: string;
  subdomain: string;
  isPrivate: boolean;
};

const CACHE_PREFIX = "subdomain:";
const CACHE_TTL_SECONDS = 60 * 5; // 5 minutes

/**
 * Get space data from Redis cache by subdomain.
 * Returns null if not found or cache miss.
 */
const getSpaceBySubdomain = async (
  subdomain: string
): Promise<CachedSpace | null> => {
  const redis = getEdgeRedis();
  if (!redis) return null;

  try {
    const cached = await redis.get<CachedSpace>(`${CACHE_PREFIX}${subdomain}`);
    return cached;
  } catch (error) {
    console.error("[Subdomain Cache] Error fetching:", error);
    return null;
  }
};

/**
 * Set space data in Redis cache.
 */
const setSpaceCache = async (
  subdomain: string,
  space: CachedSpace
): Promise<void> => {
  const redis = getEdgeRedis();
  if (!redis) return;

  try {
    await redis.set(`${CACHE_PREFIX}${subdomain}`, space, {
      ex: CACHE_TTL_SECONDS,
    });
  } catch (error) {
    console.error("[Subdomain Cache] Error setting:", error);
  }
};

/**
 * Invalidate space cache when subdomain changes.
 */
const invalidateSpaceCache = async (subdomain: string): Promise<void> => {
  const redis = getEdgeRedis();
  if (!redis) return;

  try {
    await redis.del(`${CACHE_PREFIX}${subdomain}`);
  } catch (error) {
    console.error("[Subdomain Cache] Error invalidating:", error);
  }
};

export {
  getSpaceBySubdomain,
  setSpaceCache,
  invalidateSpaceCache,
};
export type { CachedSpace };
