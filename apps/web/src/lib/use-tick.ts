"use client";

import { useSyncExternalStore } from "react";

type TickStore = {
  getSnapshot: () => number;
  subscribe: (listener: () => void) => () => void;
};

/** One interval per store, shared by every subscriber, so they all read the same instant. */
const createTickStore = (intervalMs: number): TickStore => {
  let now = Date.now();
  const listeners = new Set<() => void>();
  let stop: (() => void) | null = null;

  const tick = () => {
    now = Date.now();

    for (const listener of listeners) {
      listener();
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      tick();
    }
  };

  return {
    getSnapshot: () => now,
    subscribe: (listener) => {
      if (listeners.size === 0) {
        now = Date.now();
        const interval = setInterval(tick, intervalMs);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        stop = () => {
          clearInterval(interval);
          document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
      }

      listeners.add(listener);

      return () => {
        listeners.delete(listener);

        if (listeners.size === 0) {
          stop?.();
          stop = null;
        }
      };
    },
  };
};

const getServerSnapshot = (): null => null;

const secondTickStore = createTickStore(1000);
const halfMinuteTickStore = createTickStore(30_000);

/** The current time in ms, or null before hydration. */
const useSecondTick = (): number | null =>
  useSyncExternalStore(secondTickStore.subscribe, secondTickStore.getSnapshot, getServerSnapshot);

/** The current time in ms, or null before hydration. */
const useHalfMinuteTick = (): number | null =>
  useSyncExternalStore(
    halfMinuteTickStore.subscribe,
    halfMinuteTickStore.getSnapshot,
    getServerSnapshot,
  );

/** The current time on the half-minute clock, or null before hydration. */
const useNow = (): Date | null => {
  const tick = useHalfMinuteTick();

  return tick === null ? null : new Date(tick);
};

export { useHalfMinuteTick, useNow, useSecondTick };
