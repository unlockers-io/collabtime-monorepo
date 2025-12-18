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

// 1-second tick for real-time displays (clock display)
const secondTickStore = createTickStore(1_000);

// 30-second tick for timeline indicators (less frequent updates for performance)
const halfMinuteTickStore = createTickStore(30_000);

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook that triggers a re-render every second.
 * Useful for real-time clock displays.
 *
 * @returns The current timestamp (use this as a dependency to force recalculation)
 */
const useSecondTick = (): number =>
  useSyncExternalStore(
    secondTickStore.subscribe,
    secondTickStore.getSnapshot,
    secondTickStore.getServerSnapshot
  );

/**
 * Hook that triggers a re-render every 30 seconds.
 * Useful for timeline indicators where second-precision isn't needed.
 *
 * @returns The current timestamp (use this as a dependency to force recalculation)
 */
const useHalfMinuteTick = (): number =>
  useSyncExternalStore(
    halfMinuteTickStore.subscribe,
    halfMinuteTickStore.getSnapshot,
    halfMinuteTickStore.getServerSnapshot
  );

export { createTickStore, useHalfMinuteTick, useSecondTick };
