import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "./query-keys";
import { createTeamQueryInvalidator } from "./team-query-sync";

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const queryKey = queryKeys.teams.detail("team-1");
  const queryFn = vi.fn<() => Promise<string>>().mockResolvedValue("latest");
  queryClient.setQueryData(queryKey, "initial");
  const observer = new QueryObserver(queryClient, { queryFn, queryKey });
  const unsubscribe = observer.subscribe(() => undefined);
  const invalidator = createTeamQueryInvalidator(queryClient, "team-1");
  const dispose = () => {
    invalidator.dispose();
    unsubscribe();
    queryClient.clear();
  };
  return { dispose, invalidator, queryClient, queryFn, queryKey };
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("live query invalidation", () => {
  it("coalesces a notification burst into one fetch", async () => {
    const state = setup();
    state.invalidator.notify();
    state.invalidator.notify();
    state.invalidator.notify();
    await vi.advanceTimersByTimeAsync(249);
    expect(state.queryFn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(state.queryFn).toHaveBeenCalledTimes(1);
    expect(state.queryClient.getQueryData(state.queryKey)).toBe("latest");
    state.dispose();
  });

  it("fetches again when a change arrives during an existing fetch", async () => {
    const state = setup();
    const first = Promise.withResolvers<string>();
    state.queryFn.mockReturnValueOnce(first.promise);
    const fetching = state.queryClient.refetchQueries({ queryKey: state.queryKey });
    state.invalidator.notify();
    await vi.advanceTimersByTimeAsync(250);
    expect(state.queryFn).toHaveBeenCalledTimes(1);
    first.resolve("before-remote-edit");
    await fetching;
    await vi.advanceTimersByTimeAsync(0);
    expect(state.queryFn).toHaveBeenCalledTimes(2);
    expect(state.queryClient.getQueryData(state.queryKey)).toBe("latest");
    state.dispose();
  });

  it("cancels pending invalidation on unmount", async () => {
    const state = setup();
    state.invalidator.notify();
    state.dispose();
    await vi.advanceTimersByTimeAsync(250);
    expect(state.queryFn).not.toHaveBeenCalled();
  });

  it("shares a burst across consumers and preserves it when one unmounts", async () => {
    const state = setup();
    const second = createTeamQueryInvalidator(state.queryClient, "team-1");
    state.invalidator.notify();
    second.notify();
    second.dispose();
    second.dispose();
    await vi.advanceTimersByTimeAsync(250);
    expect(state.queryFn).toHaveBeenCalledTimes(1);
    expect(state.queryClient.getQueryData(state.queryKey)).toBe("latest");
    state.dispose();
  });
});
