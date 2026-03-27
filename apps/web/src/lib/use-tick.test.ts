import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useHalfMinuteTick, useSecondTick } from "./use-tick";

describe("useSecondTick", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a number", () => {
    const { result } = renderHook(() => useSecondTick());
    expect(typeof result.current).toBe("number");
  });

  it("updates after 1 second", () => {
    const { result } = renderHook(() => useSecondTick());
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).not.toBe(initial);
  });

  it("does not update before 1 second", () => {
    const { result } = renderHook(() => useSecondTick());
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe(initial);
  });
});

describe("useHalfMinuteTick", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a number", () => {
    const { result } = renderHook(() => useHalfMinuteTick());
    expect(typeof result.current).toBe("number");
  });

  it("updates after 30 seconds", () => {
    const { result } = renderHook(() => useHalfMinuteTick());
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current).not.toBe(initial);
  });
});
