"use client";

import { useSyncExternalStore } from "react";

// ============================================================================
// Types
// ============================================================================

type TickStore = {
  subscribe: (callback: () => void) => () => void;
  getSnapshot: () => number;
  getServerSnapshot: () => number;
};

// ============================================================================
// Factory
// ============================================================================

/**
 * Creates a tick store that updates at the specified interval.
 * Includes visibility change handling to update immediately when the page regains focus.
 */
const createTickStore = (intervalMs: number): TickStore => {
  let cachedTick = Date.now();

  const subscribe = (callback: () => void) => {
    const interval = setInterval(() => {
      cachedTick = Date.now();
      callback();
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        cachedTick = Date.now();
        callback();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  };

  const getSnapshot = () => cachedTick;
  const getServerSnapshot = () => 0;

  return { subscribe, getSnapshot, getServerSnapshot };
};

// ============================================================================
// Shared Store Instances
// ============================================================================

// 1-second tick for real-time displays (clock, current time indicator)
const secondTickStore = createTickStore(1_000);

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook that triggers a re-render every second.
 * Useful for real-time clock displays and current time indicators.
 *
 * @returns The current timestamp (use this as a dependency to force recalculation)
 */
const useSecondTick = (): number =>
  useSyncExternalStore(
    secondTickStore.subscribe,
    secondTickStore.getSnapshot,
    secondTickStore.getServerSnapshot
  );

export { useSecondTick, createTickStore };
