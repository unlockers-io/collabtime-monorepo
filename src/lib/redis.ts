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

// TTL for newly created teams (2 months)
const TEAM_INITIAL_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

// TTL for teams with members (2 years)
const TEAM_ACTIVE_TTL_SECONDS = 60 * 60 * 24 * 365 * 2; // 2 years

// TTL for session tokens (7 days)
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export { redis, SESSION_TTL_SECONDS, TEAM_ACTIVE_TTL_SECONDS, TEAM_INITIAL_TTL_SECONDS };
