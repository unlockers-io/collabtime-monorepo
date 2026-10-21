// @vitest-environment node
import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("cutover identity probe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CUTOVER_IDENTITY_BEARER", bearer);
    vi.stubEnv("CUTOVER_IDENTITY_EXPIRES_AT", String(Date.now() + 60_000));
    vi.stubEnv("VERCEL_URL", host);
    readRedisServerInfo.mockResolvedValue(`redis_version:8.6.3\r\nrun_id:${"a".repeat(40)}\r\n`);
  });
  afterEach(() => vi.unstubAllEnvs());

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
