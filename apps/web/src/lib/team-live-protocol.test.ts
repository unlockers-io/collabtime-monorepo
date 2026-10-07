// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { maxDuration } from "@/app/api/teams/[teamId]/events/route";

import { VALID_UUID } from "./actions/test-helpers";
import { LEASE_SECONDS } from "./team-event-admission";
import { createTeamEventStream, type AccessResult } from "./team-event-stream";
import type { TeamEvent, TeamListener } from "./team-events";
import { createTeamLiveRegistry, type LiveObserver } from "./team-live-connection";
import { STREAM_LIFETIME_MS, teamEventsUrl } from "./team-live-protocol";

class StreamEventSource extends EventTarget {
  readonly #reader: ReadableStreamDefaultReader<string>;
  #closed = false;

  constructor(response: Response) {
    super();
    this.#reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    void this.#pump("");
  }

  close() {
    this.#closed = true;
    void this.#reader.cancel();
  }

  async #pump(buffered: string): Promise<void> {
    const chunk = await this.#reader.read();
    if (chunk.done) {
      if (!this.#closed) {
        this.dispatchEvent(new Event("error"));
      }
      return;
    }
    const frames = `${buffered}${chunk.value}`.split("\n\n");
    const rest = frames.pop() ?? "";
    for (const frame of frames) {
      const name = /^event: (?<name>.+)$/mv.exec(frame)?.groups?.name;
      if (name !== undefined) {
        this.dispatchEvent(new Event(name));
      }
    }
    return this.#pump(rest);
  }
}

const setup = () => {
  const listeners = new Set<TeamListener>();
  const checkAccess = vi.fn<() => Promise<AccessResult>>().mockResolvedValue("allowed");
  const release = vi.fn<() => Promise<void>>().mockResolvedValue();
  const createSource = vi.fn(
    (_url: string) =>
      new StreamEventSource(
        createTeamEventStream({
          checkAccess,
          isReady: () => true,
          log: { error: vi.fn<() => void>(), info: vi.fn<() => void>() },
          principal: "guest",
          release,
          signal: new AbortController().signal,
          startedAt: Date.now(),
          subscribe: (listener) => {
            listeners.add(listener);
            return () => {
              listeners.delete(listener);
            };
          },
          teamId: VALID_UUID,
        }),
      ),
  );
  const registry = createTeamLiveRegistry({
    checkAccess: () => Promise.resolve(204),
    createSource,
    isVisible: () => true,
    onVisibilityChange: () => () => undefined,
    random: () => 0,
  });
  const emit = (kind: TeamEvent["kind"]) => {
    for (const listener of listeners) {
      listener({ at: Date.now(), kind, teamId: VALID_UUID });
    }
  };
  return { checkAccess, createSource, emit, registry, release };
};

const observer = (): LiveObserver => ({
  change: vi.fn<() => void>(),
  space: vi.fn<() => void>(),
  status: vi.fn<() => void>(),
  terminal: vi.fn<() => void>(),
});

describe("team live protocol", () => {
  it.each([
    ["space", "revoked"],
    ["deleted", "deleted"],
  ] as const)(
    "carries server frames to client observers until a %s event ends access as %s",
    async (kind, access) => {
      const state = setup();
      const listener = observer();
      const unsubscribe = state.registry.subscribe(VALID_UUID, listener);
      expect(state.createSource).toHaveBeenCalledExactlyOnceWith(teamEventsUrl(VALID_UUID));
      await vi.waitFor(() => {
        expect(state.registry.getStatus(VALID_UUID)).toBe("live");
      });
      expect(listener.change).toHaveBeenCalledTimes(1);
      state.emit("contents");
      await vi.waitFor(() => {
        expect(listener.change).toHaveBeenCalledTimes(2);
      });
      state.emit("space");
      await vi.waitFor(() => {
        expect(listener.space).toHaveBeenCalledTimes(1);
      });
      state.checkAccess.mockResolvedValue(access);
      state.emit(kind);
      await vi.waitFor(() => {
        expect(listener.terminal).toHaveBeenCalledTimes(1);
      });
      expect(state.registry.getStatus(VALID_UUID)).toBe("offline");
      expect(state.release).toHaveBeenCalledTimes(1);
      expect(state.createSource).toHaveBeenCalledTimes(1);
      unsubscribe();
    },
  );

  it("rotates streams before the route deadline and holds leases past it", () => {
    expect(STREAM_LIFETIME_MS).toBeLessThan(maxDuration * 1000);
    expect(maxDuration).toBeLessThan(LEASE_SECONDS);
  });
});
