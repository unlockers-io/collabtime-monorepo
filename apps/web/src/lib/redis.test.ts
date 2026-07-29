import { beforeEach, describe, expect, it, vi } from "vitest";

const { expireMock, getMock, logErrorMock } = vi.hoisted(() => ({
  expireMock: vi.fn(),
  getMock: vi.fn(),
  logErrorMock: vi.fn(),
}));

vi.mock("ioredis", () => ({
  // `new Redis(...)`, so the stub has to be constructible.
  Redis: class {
    expire = expireMock;
    get = getMock;
  },
}));

vi.mock("@/lib/observability", () => ({ log: { error: logErrorMock } }));

process.env.REDIS_URL = "redis://localhost:6379";

import { readTeamJson, TEAM_ACTIVE_TTL_SECONDS } from "./redis";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";

describe("readTeamJson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-extends the key's TTL on a hit, so reading keeps a team alive", async () => {
    getMock.mockResolvedValue('{"name":"Team"}');

    const data = await readTeamJson(TEAM_ID);

    expect(data).toBe('{"name":"Team"}');
    expect(expireMock).toHaveBeenCalledWith(`team:${TEAM_ID}`, TEAM_ACTIVE_TTL_SECONDS);
  });

  it("does not resurrect a missing key", async () => {
    getMock.mockResolvedValue(null);

    expect(await readTeamJson(TEAM_ID)).toBeNull();
    expect(expireMock).not.toHaveBeenCalled();
  });

  it("treats an empty payload as a miss", async () => {
    getMock.mockResolvedValue("");

    expect(await readTeamJson(TEAM_ID)).toBeNull();
    expect(expireMock).not.toHaveBeenCalled();
  });

  it("still returns the data when the refresh fails", async () => {
    getMock.mockResolvedValue('{"name":"Team"}');
    expireMock.mockRejectedValue(new Error("connection reset"));

    expect(await readTeamJson(TEAM_ID)).toBe('{"name":"Team"}');
    expect(logErrorMock).toHaveBeenCalled();
  });
});
