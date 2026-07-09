"use client";

import { useSyncExternalStore } from "react";

type TickStore = {
  getServerSnapshot: () => number;
  getSnapshot: () => number;
  subscribe: (callback: () => void) => () => void;
};

const getServerSnapshot = () => 0;

// Updates immediately on visibilitychange so a backgrounded tab shows fresh
// time the moment it regains focus, not after the next interval.
const createTickStore = (intervalMs: number): TickStore => {
  let cachedTick = Date.now();

  const subscribe = (callback: () => void) => {
    const interval = setInterval(() => {
      cachedTick = Date.now();
      callback();
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      cachedTick = Date.now();
      callback();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  };

  const getSnapshot = () => cachedTick;

  return { getServerSnapshot, getSnapshot, subscribe };
};

const secondTickStore = createTickStore(1000);
const halfMinuteTickStore = createTickStore(30_000);

const useSecondTick = (): number =>
  useSyncExternalStore(
    secondTickStore.subscribe,
    secondTickStore.getSnapshot,
    secondTickStore.getServerSnapshot,
  );

const useHalfMinuteTick = (): number =>
  useSyncExternalStore(
    halfMinuteTickStore.subscribe,
    halfMinuteTickStore.getSnapshot,
    halfMinuteTickStore.getServerSnapshot,
  );

export { useHalfMinuteTick, useSecondTick };
