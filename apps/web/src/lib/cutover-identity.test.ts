// @vitest-environment node
import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HEAD } from "@/app/api/internal/cutover-identity/route";
import * as redis from "@/lib/redis";

import { createCutoverIdentityHandler } from "./cutover-identity";

const readRedisServerInfo = vi.fn<() => Promise<string>>();
const GET = createCutoverIdentityHandler(readRedisServerInfo);

const bearer = "test-only-transient-bearer-1234567890";
const host = "probe-deployment.example.test";
const url = `https://${host}/api/internal/cutover-identity`;
const request = (overrides: RequestInit = {}, target = url) =>
  new Request(target, {
    headers: { authorization: `Bearer ${bearer}`, host },
    ...overrides,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(redis, "createRedisClient");
  vi.stubEnv("CUTOVER_IDENTITY_BEARER", bearer);
  vi.stubEnv("CUTOVER_IDENTITY_EXPIRES_AT", String(Date.now() + 60_000));
  vi.stubEnv("VERCEL_URL", host);
  readRedisServerInfo.mockResolvedValue(`redis_version:8.6.3\r\nrun_id:${"a".repeat(40)}\r\n`);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("cutover identity probe", () => {
  it.each([
    ["CUTOVER_IDENTITY_BEARER", ""],
    ["CUTOVER_IDENTITY_BEARER", "short"],
    ["CUTOVER_IDENTITY_EXPIRES_AT", ""],
    ["CUTOVER_IDENTITY_EXPIRES_AT", "invalid"],
    ["CUTOVER_IDENTITY_EXPIRES_AT", "1"],
    ["CUTOVER_IDENTITY_EXPIRES_AT", String(Date.now() + 60 * 60 * 1000)],
    ["VERCEL_URL", ""],
  ])("stays closed with invalid %s", async (name, value) => {
    vi.stubEnv(name, value);
    const response = await GET(request());
    expect(response.status).toBe(404);
    expect(readRedisServerInfo).not.toHaveBeenCalled();
  });

  it.each([
    request({ headers: { host } }),
    request({ headers: { authorization: "Bearer wrong", host } }),
    request({ headers: { authorization: `Bearer ${bearer}`, host: "legacy.example.test" } }),
    request({ method: "HEAD" }),
    request({}, `${url}?extra=1`),
    request({}, `${url}/extra`),
  ])("rejects unauthorized or mismatched requests before connecting", async (input) => {
    const response = await GET(input);
    expect(response.status).toBe(404);
    expect(readRedisServerInfo).not.toHaveBeenCalled();
  });

  it("returns only the SHA256 of run_id", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      redisRunIdSha256: createHash("sha256").update("a".repeat(40)).digest("hex"),
    });
    expect(readRedisServerInfo).toHaveBeenCalledOnce();
  });

  it.each(["", "run_id:invalid\r\n"])("rejects missing or malformed identity", async (info) => {
    readRedisServerInfo.mockResolvedValue(info);
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
  });

  it("does not expose connection failures", async () => {
    readRedisServerInfo.mockRejectedValue(new Error("private connection details"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
  });
});

describe("probe configuration boundaries", () => {
  it.each(["CUTOVER_IDENTITY_BEARER", "CUTOVER_IDENTITY_EXPIRES_AT", "VERCEL_URL"])(
    "stays closed with missing %s",
    async (name) => {
      vi.stubEnv(name, undefined);
      const response = await GET(request());
      expect(response.status).toBe(404);
      expect(readRedisServerInfo).not.toHaveBeenCalled();
    },
  );

  it.each([0, 15 * 60 * 1000 + 1, 60_000.5])(
    "rejects an invalid remaining lifetime of %s ms before connecting",
    async (remaining) => {
      vi.spyOn(Date, "now").mockReturnValue(1_000_000);
      vi.stubEnv("CUTOVER_IDENTITY_EXPIRES_AT", String(Date.now() + remaining));
      const response = await GET(request());
      expect(response.status).toBe(404);
      expect(readRedisServerInfo).not.toHaveBeenCalled();
    },
  );

  it("accepts the exact 15-minute maximum lifetime", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    vi.stubEnv("CUTOVER_IDENTITY_EXPIRES_AT", String(Date.now() + 15 * 60 * 1000));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(readRedisServerInfo).toHaveBeenCalledOnce();
  });
});

describe("explicit HEAD readiness", () => {
  it("returns empty no-store 204 without creating a Redis client", async () => {
    const response = HEAD(request({ method: "HEAD" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
    expect(redis.createRedisClient).not.toHaveBeenCalled();
    expect(readRedisServerInfo).not.toHaveBeenCalled();
  });

  it.each([
    request({ headers: { host }, method: "HEAD" }),
    request({ headers: { authorization: "Bearer wrong", host }, method: "HEAD" }),
    request({ headers: { authorization: `Bearer ${bearer}` }, method: "HEAD" }),
    request({
      headers: { authorization: `Bearer ${bearer}`, host: "legacy.example.test" },
      method: "HEAD",
    }),
    request({ method: "HEAD" }, `${url}?extra=1`),
    request({ method: "HEAD" }, `${url}/extra`),
    request({ method: "GET" }),
    request({ method: "POST" }),
  ])("stays closed for a mismatched request without creating a client", async (input) => {
    const response = HEAD(input);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
    expect(redis.createRedisClient).not.toHaveBeenCalled();
    expect(readRedisServerInfo).not.toHaveBeenCalled();
  });
});

describe("HEAD configuration and expiry gates", () => {
  it.each([
    ["CUTOVER_IDENTITY_BEARER", undefined],
    ["CUTOVER_IDENTITY_BEARER", ""],
    ["CUTOVER_IDENTITY_BEARER", "short"],
    ["CUTOVER_IDENTITY_EXPIRES_AT", undefined],
    ["CUTOVER_IDENTITY_EXPIRES_AT", ""],
    ["CUTOVER_IDENTITY_EXPIRES_AT", "invalid"],
    ["CUTOVER_IDENTITY_EXPIRES_AT", "1"],
    ["VERCEL_URL", undefined],
    ["VERCEL_URL", ""],
  ])("stays indistinguishably closed for invalid %s", async (name, value) => {
    vi.stubEnv(name, value);
    const response = HEAD(request({ method: "HEAD" }));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(redis.createRedisClient).not.toHaveBeenCalled();
  });

  it.each([0, -1, 15 * 60 * 1000 + 1, 60_000.5])(
    "rejects an invalid remaining lifetime of %s ms without creating a client",
    (remaining) => {
      vi.spyOn(Date, "now").mockReturnValue(1_000_000);
      vi.stubEnv("CUTOVER_IDENTITY_EXPIRES_AT", String(Date.now() + remaining));
      const response = HEAD(request({ method: "HEAD" }));
      expect(response.status).toBe(404);
      expect(redis.createRedisClient).not.toHaveBeenCalled();
    },
  );

  it("accepts exactly 15 minutes without creating a client", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    vi.stubEnv("CUTOVER_IDENTITY_EXPIRES_AT", String(Date.now() + 15 * 60 * 1000));
    expect(HEAD(request({ method: "HEAD" })).status).toBe(204);
    expect(redis.createRedisClient).not.toHaveBeenCalled();
  });
});
