import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionResult } from "@/lib/actions/types";
import { queryKeys } from "@/lib/query-keys";
import { createTeamQueryInvalidator } from "@/lib/team-query-sync";
import type { Team } from "@/types";

import { useTeamWrite } from "./use-team-cache";

type TeamQueryData = { team: Team };

const makeTeam = (name: string): Team => ({
  createdAt: "2026-01-01T00:00:00.000Z",
  groups: [],
  id: "team-1",
  members: [],
  name,
});
const design = { id: "group-1", name: "Design", order: 0 };
const rename = (name: string) => (team: Team) => ({ ...team, name });
const addDesign = (team: Team) => ({ ...team, groups: [...team.groups, design] });
const succeeded: ActionResult<undefined> = { data: undefined, success: true };
const failed: ActionResult<undefined> = { error: "Group not found", success: false };

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const queryKey = queryKeys.teams.detail("team-1");
  const queryFn = vi
    .fn<() => Promise<TeamQueryData>>()
    .mockResolvedValue({ team: makeTeam("server") });
  queryClient.setQueryData<TeamQueryData>(queryKey, { team: makeTeam("initial") });
  const unsubscribe = new QueryObserver(queryClient, { queryFn, queryKey }).subscribe(
    () => undefined,
  );
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useTeamWrite("team-1"), { wrapper: Wrapper });
  const cachedTeam = () => queryClient.getQueryData<TeamQueryData>(queryKey)?.team;
  const dispose = () => {
    hook.unmount();
    unsubscribe();
    queryClient.clear();
  };
  return { cachedTeam, dispose, queryClient, queryFn, write: hook.result.current };
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("team writes", () => {
  it("defers a live change until the write settles, then refetches once", async () => {
    const state = setup();
    const invalidator = createTeamQueryInvalidator(state.queryClient, "team-1");
    const submit = Promise.withResolvers<ActionResult<undefined>>();
    const writing = state.write({ optimistic: rename("optimistic"), submit: () => submit.promise });
    await vi.advanceTimersByTimeAsync(0);
    invalidator.notify();
    await vi.advanceTimersByTimeAsync(250);
    expect(state.queryFn).not.toHaveBeenCalled();
    expect(state.cachedTeam()?.name).toBe("optimistic");
    submit.resolve(succeeded);
    await writing;
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.queryFn).toHaveBeenCalledTimes(1);
    expect(state.cachedTeam()?.name).toBe("server");
    invalidator.dispose();
    state.dispose();
  });

  it("keeps a concurrent write's patch when an earlier write fails", async () => {
    const state = setup();
    const first = Promise.withResolvers<ActionResult<undefined>>();
    const second = Promise.withResolvers<ActionResult<undefined>>();
    const writingFirst = state.write({
      optimistic: rename("renamed"),
      submit: () => first.promise,
    });
    const writingSecond = state.write({ optimistic: addDesign, submit: () => second.promise });
    await vi.advanceTimersByTimeAsync(0);
    first.resolve(failed);
    await expect(writingFirst).resolves.toEqual(failed);
    expect(state.cachedTeam()?.groups).toEqual([design]);
    expect(state.queryFn).not.toHaveBeenCalled();
    second.resolve(succeeded);
    await writingSecond;
    expect(state.cachedTeam()).toEqual(makeTeam("server"));
    state.dispose();
  });

  it("restores the previous team when a lone write fails", async () => {
    const state = setup();
    const refetch = Promise.withResolvers<TeamQueryData>();
    state.queryFn.mockReturnValueOnce(refetch.promise);
    const submit = Promise.withResolvers<ActionResult<undefined>>();
    const writing = state.write({ optimistic: rename("optimistic"), submit: () => submit.promise });
    await vi.advanceTimersByTimeAsync(0);
    expect(state.cachedTeam()?.name).toBe("optimistic");
    submit.resolve(failed);
    await vi.advanceTimersByTimeAsync(0);
    expect(state.cachedTeam()?.name).toBe("initial");
    refetch.resolve({ team: makeTeam("server") });
    await expect(writing).resolves.toEqual(failed);
    expect(state.cachedTeam()?.name).toBe("server");
    state.dispose();
  });

  it("refetches only when the last overlapping write settles", async () => {
    const state = setup();
    const first = Promise.withResolvers<ActionResult<undefined>>();
    const second = Promise.withResolvers<ActionResult<undefined>>();
    const writingFirst = state.write({ submit: () => first.promise });
    const writingSecond = state.write({ submit: () => second.promise });
    first.resolve(succeeded);
    await writingFirst;
    expect(state.queryFn).not.toHaveBeenCalled();
    second.resolve(succeeded);
    await writingSecond;
    expect(state.queryFn).toHaveBeenCalledTimes(1);
    state.dispose();
  });
});
