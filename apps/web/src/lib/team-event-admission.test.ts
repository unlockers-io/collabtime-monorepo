// @vitest-environment node
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";

import { createTeamEventAdmission, type AdmissionDeps } from "./team-event-admission";

const setup = () => {
  const afterResponse: Array<() => Promise<void>> = [];
  const deps: AdmissionDeps = {
    acquire: vi.fn<AdmissionDeps["acquire"]>().mockResolvedValue(true),
    after: (callback) => {
      afterResponse.push(callback);
    },
    checkRateLimit: vi
      .fn<AdmissionDeps["checkRateLimit"]>()
      .mockResolvedValue({ allowed: true, remaining: 29 }),
    createId: () => "connection-1",
    release: vi.fn<AdmissionDeps["release"]>().mockResolvedValue(1),
    reportError: vi.fn<() => void>(),
  };
  return { admit: createTeamEventAdmission(deps), afterResponse, deps };
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("team event admission", () => {
  it.each([
    [true, 10],
    [false, 40],
  ] as const)("caps authenticated=%s at %s and releases once", async (authenticated, limit) => {
    const state = setup();
    const result = await state.admit("principal", authenticated);
    expect(state.deps.checkRateLimit).toHaveBeenCalledWith("live-open:principal", 30, 60);
    expect(state.deps.acquire).toHaveBeenCalledWith(
      "live-connections:principal",
      "connection-1",
      limit,
    );
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      await result.release();
      await result.release();
    }
    expect(state.deps.release).toHaveBeenCalledExactlyOnceWith(
      "live-connections:principal",
      "connection-1",
    );
  });

  it("rejects excessive attempts before acquiring a lease", async () => {
    const state = setup();
    vi.mocked(state.deps.checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0 });
    expect(await state.admit("principal", true)).toEqual({ allowed: false, status: 429 });
    expect(state.deps.acquire).not.toHaveBeenCalled();
    expect(state.afterResponse).toHaveLength(0);
  });

  it("rejects a full lease set and handles storage errors", async () => {
    const state = setup();
    vi.mocked(state.deps.acquire)
      .mockResolvedValueOnce(false)
      .mockRejectedValue(new Error("redis down"));
    expect(await state.admit("principal", true)).toEqual({ allowed: false, status: 429 });
    expect(await state.admit("principal", true)).toEqual({ allowed: false, status: 503 });
    expect(state.deps.reportError).toHaveBeenCalledTimes(1);
  });

  it("releases a lease that succeeds after the admission deadline", async () => {
    const state = setup();
    const acquiring = Promise.withResolvers<boolean>();
    vi.mocked(state.deps.acquire).mockReturnValue(acquiring.promise);
    const result = state.admit("principal", true);
    await vi.advanceTimersByTimeAsync(1001);
    expect(await result).toEqual({ allowed: false, status: 503 });
    expect(state.afterResponse).toHaveLength(1);
    const [respond] = state.afterResponse;
    assert(respond, "expected an after-response callback");
    const cleanup = respond();
    acquiring.resolve(true);
    await cleanup;
    expect(state.deps.release).toHaveBeenCalledExactlyOnceWith(
      "live-connections:principal",
      "connection-1",
    );
  });

  it("keeps after-response cleanup waiting for a release already started by the stream", async () => {
    const state = setup();
    const releasing = Promise.withResolvers<number>();
    vi.mocked(state.deps.release).mockReturnValue(releasing.promise);
    const result = await state.admit("principal", true);
    expect(result.allowed).toBe(true);
    if (!result.allowed) {
      throw new Error("Expected admission");
    }
    expect(state.afterResponse).toHaveLength(1);
    const fromStream = result.release();
    const [respond] = state.afterResponse;
    assert(respond, "expected an after-response callback");
    const afterResponse = respond();
    expect(afterResponse).toBe(fromStream);
    const finished = vi.fn<() => void>();
    const observeCleanup = async () => {
      await afterResponse;
      finished();
    };
    void observeCleanup();
    await vi.advanceTimersByTimeAsync(0);
    expect(finished).not.toHaveBeenCalled();
    releasing.resolve(1);
    await afterResponse;
    expect(finished).toHaveBeenCalledTimes(1);
    expect(state.deps.release).toHaveBeenCalledTimes(1);
  });

  it("releases after response completion even if stream cleanup was not called", async () => {
    const state = setup();
    await state.admit("principal", true);
    expect(state.deps.release).not.toHaveBeenCalled();
    const [respond] = state.afterResponse;
    assert(respond, "expected an after-response callback");
    await respond();
    expect(state.deps.release).toHaveBeenCalledTimes(1);
  });
});
