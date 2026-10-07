import { randomUUID } from "node:crypto";

import { after } from "next/server";

import { log } from "./observability";
import { TimeoutError, withTimeout } from "./promise-timeout";
import { redis } from "./redis";
import { checkRateLimit } from "./space-rate-limit";

const LEASE_SECONDS = 360;
const ACQUIRE_LEASE = `
  local time = redis.call("TIME")
  local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
  redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", now)
  if redis.call("ZCARD", KEYS[1]) >= tonumber(ARGV[2]) then
    return 0
  end
  redis.call("ZADD", KEYS[1], now + tonumber(ARGV[3]) * 1000, ARGV[1])
  redis.call("EXPIRE", KEYS[1], ARGV[3])
  return 1
`;

type Admission =
  | { allowed: true; release: () => Promise<void> }
  | { allowed: false; status: 429 | 503 };
type AdmissionViewer = { ip: string; userId: string | undefined };
type AdmissionDeps = {
  acquire: (key: string, id: string, limit: number) => Promise<boolean>;
  after: (callback: () => Promise<void>) => void;
  checkRateLimit: typeof checkRateLimit;
  createId: () => string;
  release: (key: string, id: string) => Promise<number>;
  reportError: typeof log.error;
};

const createTeamEventAdmission = (deps: AdmissionDeps) => {
  return async ({ ip, userId }: AdmissionViewer): Promise<Admission> => {
    const principal = userId === undefined ? `ip:${ip}` : `user:${userId}`;
    const id = deps.createId();
    const key = `live-connections:${principal}`;
    let releasePromise: Promise<void> | undefined;
    const releaseLease = async () => {
      try {
        await withTimeout(deps.release(key, id), 1000);
      } catch (error) {
        deps.reportError({
          error,
          message: "Failed to release live sync lease",
          route: "lib/team-event-admission",
        });
      }
    };
    // Stream closure and after() must await the same in-flight Redis command.
    const release = () => (releasePromise ??= releaseLease());

    try {
      const attempt = await withTimeout(
        deps.checkRateLimit(`live-open:${principal}`, 30, 60),
        1000,
      );
      if (!attempt.allowed) {
        return { allowed: false, status: 429 };
      }
      const acquiring = deps.acquire(key, id, userId === undefined ? 40 : 10);
      let acquired: boolean;
      try {
        acquired = await withTimeout(acquiring, 1000);
      } catch (error) {
        if (!(error instanceof TimeoutError)) {
          throw error;
        }
        // A timed-out command may still succeed in Redis; release its unique lease afterwards.
        const releaseLate = async () => {
          try {
            if (await acquiring) {
              await release();
            }
          } catch (lateError) {
            deps.reportError({
              error: lateError,
              message: "Timed-out live sync admission failed",
              route: "lib/team-event-admission",
            });
          }
        };
        const cleanup = releaseLate();
        deps.after(() => cleanup);
        throw error;
      }
      if (!acquired) {
        return { allowed: false, status: 429 };
      }
      try {
        deps.after(release);
      } catch (error) {
        await release();
        throw error;
      }
      return { allowed: true, release };
    } catch (error) {
      deps.reportError({
        error,
        message: "Live sync admission unavailable",
        route: "lib/team-event-admission",
      });
      return { allowed: false, status: 503 };
    }
  };
};

const acquireTeamEventConnection = createTeamEventAdmission({
  acquire: async (key, id, limit) =>
    Number(await redis.eval(ACQUIRE_LEASE, 1, key, id, limit, LEASE_SECONDS)) === 1,
  after,
  checkRateLimit,
  createId: randomUUID,
  release: (key, id) => redis.zrem(key, id),
  reportError: log.error,
});

export { ACQUIRE_LEASE, acquireTeamEventConnection, createTeamEventAdmission, LEASE_SECONDS };
export type { Admission, AdmissionDeps, AdmissionViewer };
