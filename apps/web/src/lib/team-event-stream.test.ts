// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VALID_UUID } from "./actions/test-helpers";
import { withEvlog } from "./observability";
import {
  createTeamEventStream,
  type AccessResult,
  type TeamEventStreamDeps,
} from "./team-event-stream";
import type { TeamListener } from "./team-events";

const setup = (overrides: Partial<TeamEventStreamDeps> = {}) => {
  const abort = new AbortController();
  const listeners = new Set<TeamListener>();
  const checkAccess = vi.fn<() => Promise<AccessResult>>().mockResolvedValue("allowed");
  const release = vi.fn<() => Promise<void>>().mockResolvedValue();
  const log = { error: vi.fn<() => void>(), info: vi.fn<() => void>() };
  const deps: TeamEventStreamDeps = {
    checkAccess,
    isReady: () => true,
    log,
    principal: "guest",
    release,
    signal: abort.signal,
    startedAt: Date.now(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    teamId: VALID_UUID,
    ...overrides,
  };
  const emit = (kind: "contents" | "space" | "deleted" | "reconnect") => {
    for (const listener of listeners) {
      listener({ at: Date.now(), kind, teamId: VALID_UUID });
    }
  };
  return { abort, checkAccess, deps, emit, listeners, log, release };
};

const read = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
  const result = await reader.read();
  return result.done ? "EOF" : new TextDecoder().decode(result.value);
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("team event stream", () => {
  it("sends ready, notifications and unbuffered heartbeat frames", async () => {
    const state = setup();
    const response = createTeamEventStream(state.deps);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");
    const reader = response.body!.getReader();
    expect(await read(reader)).toBe(
      `retry: 2000\nevent: ready\ndata: {"teamId":"${VALID_UUID}"}\n\n`,
    );
    state.emit("contents");
    expect(await read(reader)).toContain("event: change\ndata:");
    await vi.advanceTimersByTimeAsync(25_000);
    expect(await read(reader)).toBe(": ping\n\n");
    await reader.cancel();
    expect(state.listeners.size).toBe(0);
    expect(state.release).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("subscribes before checking access and withholds content until checks finish", async () => {
    const check = Promise.withResolvers<AccessResult>();
    const state = setup({ checkAccess: () => check.promise });
    const reader = createTeamEventStream(state.deps).body!.getReader();
    expect(state.listeners.size).toBe(1);
    state.emit("contents");
    check.resolve("allowed");
    expect(await read(reader)).toContain("event: ready");
    expect(await read(reader)).toContain("event: change");
    await reader.cancel();
  });

  it.each(["deleted", "revoked"] as const)("closes on %s after an access event", async (access) => {
    const state = setup();
    const reader = createTeamEventStream(state.deps).body!.getReader();
    await read(reader);
    state.checkAccess.mockResolvedValue(access);
    state.emit("space");
    expect(await read(reader)).toBe(`event: ${access}\ndata: {}\n\n`);
    expect(await read(reader)).toBe("EOF");
    expect(state.release).toHaveBeenCalledTimes(1);
    expect(state.listeners.size).toBe(0);
  });

  it("rechecks a space change that arrives during a previous check", async () => {
    const state = setup();
    const reader = createTeamEventStream(state.deps).body!.getReader();
    await read(reader);
    const check = Promise.withResolvers<AccessResult>();
    state.checkAccess.mockReturnValueOnce(check.promise).mockResolvedValue("revoked");
    state.emit("space");
    state.emit("contents");
    state.emit("space");
    check.resolve("allowed");
    expect(await read(reader)).toContain("event: revoked");
    expect(await read(reader)).toBe("EOF");
  });

  it("refreshes authorized space properties and closes on access errors", async () => {
    const state = setup();
    const reader = createTeamEventStream(state.deps).body!.getReader();
    await read(reader);
    state.emit("space");
    expect(await read(reader)).toContain("event: space");
    state.checkAccess.mockRejectedValue(new Error("postgres down"));
    state.emit("space");
    expect(await read(reader)).toContain("event: reconnect");
    expect(await read(reader)).toBe("EOF");
    expect(state.log.error).toHaveBeenCalledTimes(1);
  });

  it("cleans up once on abort, including an already-aborted request", async () => {
    const state = setup();
    const reader = createTeamEventStream(state.deps).body!.getReader();
    await read(reader);
    state.abort.abort();
    state.abort.abort();
    await reader.cancel();
    expect(state.release).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    const aborted = setup();
    aborted.abort.abort();
    expect(await createTeamEventStream(aborted.deps).text()).toBe("");
    expect(aborted.listeners.size).toBe(0);
    expect(aborted.checkAccess).not.toHaveBeenCalled();
    expect(aborted.release).toHaveBeenCalledTimes(1);
  });

  it("rotates at 285 seconds from request entry and closes on subscriber loss", async () => {
    const state = setup({ startedAt: Date.now() - 280_000 });
    const reader = createTeamEventStream(state.deps).body!.getReader();
    await read(reader);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await read(reader)).toContain("event: reconnect");
    expect(await read(reader)).toBe("EOF");
    const disconnected = setup();
    const other = createTeamEventStream(disconnected.deps).body!.getReader();
    await read(other);
    disconnected.emit("reconnect");
    expect(await read(other)).toContain("event: reconnect");
    expect(disconnected.release).toHaveBeenCalledTimes(1);
  });

  it("bounds memory when a consumer stops reading", async () => {
    const state = setup();
    const reader = createTeamEventStream(state.deps).body!.getReader();
    await read(reader);
    for (let index = 0; index < 1000; index += 1) {
      state.emit("contents");
    }
    await expect(reader.read()).rejects.toThrow("too slow");
    expect(state.release).toHaveBeenCalledTimes(1);
    expect(state.listeners.size).toBe(0);
  });

  it("forwards cancellation through the actual evlog streaming wrapper", async () => {
    const state = setup();
    const handler = withEvlog(() => Promise.resolve(createTeamEventStream(state.deps)));
    const response = await handler();
    const reader = response.body!.getReader();
    expect(await read(reader)).toContain("event: ready");
    await reader.cancel();
    expect(state.listeners.size).toBe(0);
    expect(state.release).toHaveBeenCalledTimes(1);
  });

  it("cancels an in-flight access deadline on abort and ignores its late result", async () => {
    const check = Promise.withResolvers<AccessResult>();
    const state = setup({ checkAccess: () => check.promise });
    const reader = createTeamEventStream(state.deps).body!.getReader();
    state.abort.abort();
    expect(await read(reader)).toBe("EOF");
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
    check.resolve("allowed");
    await vi.advanceTimersByTimeAsync(0);
    expect(state.log.info).toHaveBeenCalledTimes(1);
    expect(state.release).toHaveBeenCalledTimes(1);
  });

  it("closes instead of hanging when the final access check stalls", async () => {
    const check = Promise.withResolvers<AccessResult>();
    const state = setup({ checkAccess: () => check.promise });
    const reader = createTeamEventStream(state.deps).body!.getReader();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await read(reader)).toContain("event: reconnect");
    expect(await read(reader)).toBe("EOF");
    expect(state.release).toHaveBeenCalledTimes(1);
    check.resolve("allowed");
  });
});
