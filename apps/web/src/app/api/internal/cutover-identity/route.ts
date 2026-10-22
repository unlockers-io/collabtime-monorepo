import { createCutoverIdentityHandler } from "@/lib/cutover-identity";
import { createRedisClient } from "@/lib/redis";

const readRedisServerInfo = async (): Promise<string> => {
  const redis = createRedisClient({
    commandTimeout: 5000,
    connectTimeout: 5000,
    disableClientInfo: true,
    enableOfflineQueue: false,
    enableReadyCheck: false,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  if (redis === null) {
    throw new Error("Redis is unavailable");
  }

  // connect/info reject through the handler; keep connection details out of library error output.
  redis.on("error", () => {});

  try {
    await redis.connect();

    return await redis.info("server");
  } finally {
    redis.disconnect();
  }
};

// public-route: an expiring operator bearer and exact deployment host gate this read-only probe before Redis is opened
export const GET = createCutoverIdentityHandler(readRedisServerInfo);

// public-route: the same expiring operator bearer gates readiness without creating a Redis client
export { handleCutoverIdentityReadiness as HEAD } from "@/lib/cutover-identity";
