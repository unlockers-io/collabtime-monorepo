import { Redis } from "@upstash/redis";

const getRedisConfig = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Missing required environment variables: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. " +
        "Please check your .env.local file."
    );
  }

  return { url, token };
};

const redis = new Redis(getRedisConfig());

const TEAM_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

export { redis, TEAM_TTL_SECONDS };
