// @vitest-environment node
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VALID_UUID, VALID_UUID_2 } from "./actions/test-helpers";
import { createTeamEventHub, createTeamEventPublisher, TEAM_EVENTS_CHANNEL } from "./team-events";

// oxlint-disable-next-line unicorn/prefer-event-target -- ioredis exposes Node EventEmitter lifecycle events.
class Subscriber extends EventEmitter {
  connect = vi.fn<() => Promise<void>>().mockResolvedValue();
  subscribe = vi.fn<(channel: string) => Promise<number>>().mockResolvedValue(1);
}

const setup = () => {
  const subscriber = new Subscriber();
  const createSubscriber = vi.fn(() => subscriber);
  const reportError = vi.fn<() => void>();
  const hub = createTeamEventHub({ createSubscriber, reportError });

  return { createSubscriber, hub, reportError, subscriber };
};

const start = async (state: ReturnType<typeof setup>) => {
  const waiting = state.hub.waitUntilReady();
  state.subscriber.emit("ready");
  expect(await waiting).toBe(true);
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("team event hub", () => {
  it("creates one lazy subscriber and waits for SUBSCRIBE acknowledgement", async () => {
    const state = setup();
    const acknowledgement = Promise.withResolvers<number>();
    state.subscriber.subscribe.mockReturnValue(acknowledgement.promise);
    expect(state.createSubscriber).not.toHaveBeenCalled();
    const first = state.hub.waitUntilReady();
    const second = state.hub.waitUntilReady();
    state.subscriber.emit("ready");
    expect(state.hub.isReady()).toBe(false);
    acknowledgement.resolve(1);
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(state.createSubscriber).toHaveBeenCalledTimes(1);
    expect(state.subscriber.subscribe).toHaveBeenCalledExactlyOnceWith(TEAM_EVENTS_CHANNEL);
  });

  it("bounds a cold start and ignores an acknowledgement from a lost connection", async () => {
    const state = setup();
    const acknowledgement = Promise.withResolvers<number>();
    state.subscriber.subscribe.mockReturnValueOnce(acknowledgement.promise);
    const waiting = state.hub.waitUntilReady();
    state.subscriber.emit("ready");
    state.subscriber.emit("close");
    acknowledgement.resolve(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await waiting).toBe(false);
    expect(state.hub.isReady()).toBe(false);
    await start(state);
    expect(state.subscriber.subscribe).toHaveBeenCalledTimes(2);
  });

  it("dispatches only to the matching team and isolates malformed messages and listeners", async () => {
    const state = setup();
    await start(state);

    const broken = vi.fn(() => {
      throw new Error("listener failed");
    });

    const matching = vi.fn<() => void>();
    const other = vi.fn<() => void>();
    state.hub.subscribe(VALID_UUID, broken);
    const release = state.hub.subscribe(VALID_UUID, matching);
    state.hub.subscribe(VALID_UUID_2, other);
    state.subscriber.emit("message", TEAM_EVENTS_CHANNEL, "not JSON");
    state.subscriber.emit("message", TEAM_EVENTS_CHANNEL, JSON.stringify({ teamId: VALID_UUID }));
    const event = { at: 1, kind: "contents", teamId: VALID_UUID };
    state.subscriber.emit("message", "other-channel", JSON.stringify(event));
    state.subscriber.emit("message", TEAM_EVENTS_CHANNEL, JSON.stringify(event));
    expect(matching).toHaveBeenCalledExactlyOnceWith(event);
    expect(other).not.toHaveBeenCalled();
    expect(state.reportError).toHaveBeenCalledTimes(3);
    release();
    state.subscriber.emit("message", TEAM_EVENTS_CHANNEL, JSON.stringify(event));
    expect(matching).toHaveBeenCalledTimes(1);
  });

  it.each(["close", "reconnecting", "end"])("closes listeners on %s", async (event) => {
    const state = setup();
    await start(state);
    const listener = vi.fn<() => void>();
    state.hub.subscribe(VALID_UUID, listener);
    state.subscriber.emit(event);
    expect(listener).toHaveBeenCalledExactlyOnceWith({ kind: "reconnect" });
    expect(state.hub.isReady()).toBe(false);
  });

  it("throttles connection errors and handles subscription failures", async () => {
    const state = setup();
    state.subscriber.subscribe.mockRejectedValue(new Error("subscription failed"));
    const waiting = state.hub.waitUntilReady();
    state.subscriber.emit("ready");
    await vi.advanceTimersByTimeAsync(2000);
    expect(await waiting).toBe(false);
    state.subscriber.emit("error", new Error("redis down"));
    expect(state.reportError).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    state.subscriber.emit("error", new Error("still down"));
    expect(state.reportError).toHaveBeenCalledTimes(2);
  });

  it("returns unavailable without creating a configured connection", async () => {
    const hub = createTeamEventHub({
      createSubscriber: () => null,
      reportError: vi.fn<() => void>(),
    });

    expect(await hub.waitUntilReady()).toBe(false);
  });

  it("replaces a terminated subscriber and ignores its later lifecycle events", async () => {
    const state = setup();
    await start(state);
    state.subscriber.emit("end");
    const replacement = new Subscriber();
    state.createSubscriber.mockReturnValue(replacement);
    const waiting = state.hub.waitUntilReady();
    replacement.emit("ready");
    expect(await waiting).toBe(true);
    state.subscriber.emit("ready");
    state.subscriber.emit("close");
    state.subscriber.emit("end");
    expect(state.hub.isReady()).toBe(true);
    expect(state.createSubscriber).toHaveBeenCalledTimes(2);
  });
});

describe("team event publisher", () => {
  it("publishes only notification fields and obeys the flag", async () => {
    const publish = vi
      .fn<(channel: string, message: string) => Promise<number>>()
      .mockResolvedValue(1);

    const enabled = vi.fn(() => true);

    const publisher = createTeamEventPublisher({
      enabled,
      publish,
      reportError: vi.fn<() => void>(),
    });

    await publisher(VALID_UUID, "contents");
    expect(publish).toHaveBeenCalledExactlyOnceWith(
      TEAM_EVENTS_CHANNEL,
      JSON.stringify({ at: Date.now(), kind: "contents", teamId: VALID_UUID }),
    );
    enabled.mockReturnValue(false);
    await publisher(VALID_UUID, "deleted");
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("returns after one second when publishing stalls and logs failures", async () => {
    const pending = Promise.withResolvers<number>();

    const publish = vi
      .fn<(channel: string, message: string) => Promise<number>>()
      .mockReturnValueOnce(pending.promise)
      .mockRejectedValue(new Error("publish failed"));

    const reportError = vi.fn<() => void>();
    const publisher = createTeamEventPublisher({ enabled: () => true, publish, reportError });
    const publishing = publisher(VALID_UUID, "contents");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(publishing).resolves.toBeUndefined();
    await expect(publisher(VALID_UUID, "space")).resolves.toBeUndefined();
    pending.reject(new Error("late failure"));
    expect(reportError).toHaveBeenCalledTimes(2);
  });
});
