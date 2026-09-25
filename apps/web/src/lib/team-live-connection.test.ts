import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTeamLiveRegistry,
  type LiveConnectionDeps,
  type LiveObserver,
} from "./team-live-connection";

class FakeEventSource extends EventTarget {
  close = vi.fn<() => void>();
  emit(event: string) {
    this.dispatchEvent(new Event(event));
  }
}

const observer = (): LiveObserver => ({
  change: vi.fn<() => void>(),
  space: vi.fn<() => void>(),
  status: vi.fn<() => void>(),
  terminal: vi.fn<() => void>(),
});

const setup = () => {
  const sources: Array<FakeEventSource> = [];
  let visible = true;
  const visibilityListeners = new Set<() => void>();
  const createSource = vi.fn(() => {
    const source = new FakeEventSource();
    sources.push(source);
    return source;
  });
  const checkAccess = vi.fn<LiveConnectionDeps["checkAccess"]>().mockResolvedValue(204);
  const registry = createTeamLiveRegistry({
    checkAccess,
    createSource,
    isVisible: () => visible,
    onVisibilityChange: (listener) => {
      visibilityListeners.add(listener);
      return () => {
        visibilityListeners.delete(listener);
      };
    },
    random: () => 0.5,
  });
  const sourceAt = (index: number) => {
    const source = sources[index];
    assert(source, `expected EventSource ${index}`);
    return source;
  };
  const visibility = (next: boolean) => {
    visible = next;
    for (const listener of visibilityListeners) {
      listener();
    }
  };
  return {
    checkAccess,
    createSource,
    registry,
    sourceAt,
    sources,
    visibility,
    visibilityListeners,
  };
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("team live connection", () => {
  it("shares a connection and marks it live only on ready, catching up even on first open", () => {
    const state = setup();
    const first = observer();
    const second = observer();
    const releaseFirst = state.registry.subscribe("team-1", first);
    const releaseSecond = state.registry.subscribe("team-1", second);
    expect(state.createSource).toHaveBeenCalledExactlyOnceWith("/api/teams/team-1/events");
    state.sourceAt(0).emit("open");
    expect(state.registry.getStatus("team-1")).toBe("connecting");
    state.sourceAt(0).emit("ready");
    expect(state.registry.getStatus("team-1")).toBe("live");
    expect(first.change).toHaveBeenCalledTimes(1);
    expect(second.change).toHaveBeenCalledTimes(1);
    releaseFirst();
    expect(state.sourceAt(0).close).not.toHaveBeenCalled();
    releaseSecond();
    expect(state.sourceAt(0).close).toHaveBeenCalledTimes(1);
    expect(state.visibilityListeners.size).toBe(0);
  });

  it("rotates with jitter and ignores events from an old source", async () => {
    const state = setup();
    const listener = observer();
    const release = state.registry.subscribe("team-1", listener);
    state.sourceAt(0).emit("ready");
    state.sourceAt(0).emit("reconnect");
    state.sourceAt(0).emit("error");
    expect(state.sourceAt(0).close).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2249);
    expect(state.sources).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    state.sourceAt(1).emit("ready");
    expect(listener.change).toHaveBeenCalledTimes(2);
    release();
  });

  it("owns retries for every browser error and resets backoff after recovery", async () => {
    const state = setup();
    const release = state.registry.subscribe("team-1", observer());
    state.sourceAt(0).emit("error");
    expect(state.registry.getStatus("team-1")).toBe("offline");
    await vi.advanceTimersByTimeAsync(30_000);
    state.sourceAt(1).emit("error");
    await vi.advanceTimersByTimeAsync(59_999);
    expect(state.sources).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    state.sourceAt(2).emit("ready");
    state.sourceAt(2).emit("error");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(state.sources).toHaveLength(4);
    release();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("gives hidden tabs a grace period and cancels hidden retries", async () => {
    const state = setup();
    const release = state.registry.subscribe("team-1", observer());
    state.sourceAt(0).emit("ready");
    state.visibility(false);
    await vi.advanceTimersByTimeAsync(9999);
    expect(state.sourceAt(0).close).not.toHaveBeenCalled();
    state.visibility(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(state.sources).toHaveLength(1);
    state.visibility(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(state.sourceAt(0).close).toHaveBeenCalledTimes(1);
    state.visibility(true);
    expect(state.sources).toHaveLength(2);
    state.sourceAt(1).emit("error");
    state.visibility(false);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(state.sources).toHaveLength(2);
    state.visibility(true);
    expect(state.sources).toHaveLength(3);
    release();
  });

  it.each(["revoked", "deleted"])("refreshes once and never reconnects after %s", async (event) => {
    const state = setup();
    const listener = observer();
    const release = state.registry.subscribe("team-1", listener);
    state.sourceAt(0).emit("space");
    expect(listener.space).toHaveBeenCalledTimes(1);
    state.sourceAt(0).emit(event);
    state.sourceAt(0).emit("error");
    state.visibility(false);
    state.visibility(true);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(listener.terminal).toHaveBeenCalledTimes(1);
    expect(state.sources).toHaveLength(1);
    release();
  });

  it("does not connect on an initially hidden tab", () => {
    const state = setup();
    state.visibility(false);
    const release = state.registry.subscribe("team-1", observer());
    expect(state.createSource).not.toHaveBeenCalled();
    state.visibility(true);
    expect(state.sources).toHaveLength(1);
    release();
  });

  it("keeps the retry timer when another consumer joins during backoff", async () => {
    const state = setup();
    const first = state.registry.subscribe("team-1", observer());
    state.sourceAt(0).emit("error");
    const second = state.registry.subscribe("team-1", observer());
    expect(state.sources).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(state.sources).toHaveLength(2);
    first();
    second();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([403, 404])(
    "refreshes after a hidden tab misses an access change returning %s",
    async (status) => {
      const state = setup();
      const listener = observer();
      const release = state.registry.subscribe("team-1", listener);
      state.sourceAt(0).emit("ready");
      state.visibility(false);
      await vi.advanceTimersByTimeAsync(10_000);
      state.checkAccess.mockResolvedValue(status);
      state.visibility(true);
      state.sourceAt(1).emit("error");
      await vi.advanceTimersByTimeAsync(0);
      expect(state.checkAccess).toHaveBeenCalledExactlyOnceWith(
        "/api/teams/team-1/events",
        expect.any(AbortSignal),
      );
      expect(listener.terminal).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(600_000);
      expect(state.sources).toHaveLength(2);
      expect(state.registry.getStatus("team-1")).toBe("offline");
      release();
    },
  );

  it("keeps polling and backoff when the access probe fails or is unavailable", async () => {
    const state = setup();
    const listener = observer();
    const release = state.registry.subscribe("team-1", listener);
    state.checkAccess
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(503);
    state.sourceAt(0).emit("error");
    await vi.advanceTimersByTimeAsync(30_000);
    state.sourceAt(1).emit("error");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(state.sources).toHaveLength(3);
    expect(listener.terminal).not.toHaveBeenCalled();
    release();
  });

  it("aborts an access probe on disposal and ignores its late result", async () => {
    const state = setup();
    const listener = observer();
    const pending = Promise.withResolvers<number>();
    state.checkAccess.mockReturnValue(pending.promise);
    const release = state.registry.subscribe("team-1", listener);
    state.sourceAt(0).emit("error");
    const [firstCall] = state.checkAccess.mock.calls;
    assert(firstCall, "expected an access probe");
    const [, signal] = firstCall;
    release();
    expect(signal.aborted).toBe(true);
    pending.resolve(403);
    await vi.advanceTimersByTimeAsync(0);
    expect(listener.terminal).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds a stalled access probe without delaying reconnection", async () => {
    const state = setup();
    const pending = Promise.withResolvers<number>();
    state.checkAccess.mockReturnValue(pending.promise);
    const release = state.registry.subscribe("team-1", observer());
    state.sourceAt(0).emit("error");
    const [firstCall] = state.checkAccess.mock.calls;
    assert(firstCall, "expected an access probe");
    const [, signal] = firstCall;
    await vi.advanceTimersByTimeAsync(5000);
    expect(signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(25_000);
    expect(state.sources).toHaveLength(2);
    release();
    pending.resolve(403);
  });
});
