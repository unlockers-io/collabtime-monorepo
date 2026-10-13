import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionResult } from "@/lib/actions/types";
import { queryKeys } from "@/lib/query-keys";
import { createTeamQueryInvalidator } from "@/lib/team-query-sync";
import type { Team } from "@/types";

import type { TeamQueryData } from "./use-team-query";
import { useTeamWrite } from "./use-team-write";

const makeTeam = (name: string, id = "team-1"): Team => ({
  createdAt: "2026-01-01T00:00:00.000Z",
  groups: [],
  id,
  members: [],
  name,
});
const design = { id: "group-1", name: "Design", order: 0 };
const rename = (name: string) => (team: Team) => ({ ...team, name });
const addDesign = (team: Team) => ({ ...team, groups: [...team.groups, design] });
const succeeded: ActionResult<undefined> = { data: undefined, success: true };
const failed: ActionResult<undefined> = { error: "Group not found", success: false };
const submitSuccess = () => Promise.resolve(succeeded);

const setup = (
  teamId = "team-1",
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  }),
) => {
  const queryKey = queryKeys.teams.detail(teamId);
  const queryFn = vi
    .fn<() => Promise<TeamQueryData>>()
    .mockResolvedValue({ team: makeTeam("server", teamId) });
  queryClient.setQueryData<TeamQueryData>(queryKey, { team: makeTeam("initial", teamId) });
  const unsubscribe = new QueryObserver(queryClient, { queryFn, queryKey }).subscribe(
    () => undefined,
  );
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useTeamWrite(teamId), { wrapper: Wrapper });
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
  it.each([succeeded, failed])(
    "refreshes and awaits simultaneous settlements with result %j",
    async (firstResult) => {
      const state = setup();
      const invalidator = createTeamQueryInvalidator(state.queryClient, "team-1");
      const first = Promise.withResolvers<ActionResult<undefined>>();
      const second = Promise.withResolvers<ActionResult<undefined>>();
      const refetch = Promise.withResolvers<TeamQueryData>();
      state.queryFn.mockReturnValueOnce(refetch.promise);
      const writingFirst = state.write({
        optimistic: rename("renamed"),
        submit: () => first.promise,
      });
      const writingSecond = state.write({ optimistic: addDesign, submit: () => second.promise });
      const settled = vi.fn();
      const finish = async () => {
        settled(await Promise.all([writingFirst, writingSecond]));
      };
      const writing = finish();
      await vi.advanceTimersByTimeAsync(0);
      invalidator.notify();
      await vi.advanceTimersByTimeAsync(250);
      expect(state.queryFn).not.toHaveBeenCalled();
      first.resolve(firstResult);
      second.resolve(succeeded);
      await vi.advanceTimersByTimeAsync(0);
      expect(state.queryFn).toHaveBeenCalledTimes(1);
      expect(state.cachedTeam()?.groups).toEqual([design]);
      expect(settled).not.toHaveBeenCalled();
      refetch.resolve({ team: makeTeam("canonical") });
      await writing;
      await vi.advanceTimersByTimeAsync(1000);
      expect(settled).toHaveBeenCalledWith([firstResult, succeeded]);
      expect(state.cachedTeam()?.name).toBe("canonical");
      expect(state.queryFn).toHaveBeenCalledTimes(1);
      invalidator.dispose();
      state.dispose();
    },
  );

  it.each([0, 250])("absorbs a live change %i ms before a write settles", async (elapsed) => {
    const state = setup();
    const invalidator = createTeamQueryInvalidator(state.queryClient, "team-1");
    const submit = Promise.withResolvers<ActionResult<undefined>>();
    const writing = state.write({ optimistic: rename("optimistic"), submit: () => submit.promise });
    await vi.advanceTimersByTimeAsync(0);
    invalidator.notify();
    await vi.advanceTimersByTimeAsync(elapsed);
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

  it("rolls back a thrown submission and awaits the canonical refresh before rejecting", async () => {
    const state = setup();
    const submit = Promise.withResolvers<ActionResult<undefined>>();
    const refetch = Promise.withResolvers<TeamQueryData>();
    state.queryFn.mockReturnValueOnce(refetch.promise);
    const writing = state.write({ optimistic: rename("optimistic"), submit: () => submit.promise });
    const rejected = vi.fn();
    const finish = async () => {
      await expect(writing).rejects.toThrow("Network failed");
      rejected();
    };
    const finished = finish();
    await vi.advanceTimersByTimeAsync(0);
    submit.reject(new Error("Network failed"));
    await vi.advanceTimersByTimeAsync(0);
    expect(state.cachedTeam()?.name).toBe("initial");
    expect(state.queryFn).toHaveBeenCalledTimes(1);
    expect(rejected).not.toHaveBeenCalled();
    refetch.resolve({ team: makeTeam("canonical") });
    await finished;
    expect(rejected).toHaveBeenCalledOnce();
    expect(state.cachedTeam()?.name).toBe("canonical");
    state.dispose();
  });

  it("refreshes another team while the first team's write is pending", async () => {
    const first = setup();
    const second = setup("team-2", first.queryClient);
    const submit = Promise.withResolvers<ActionResult<undefined>>();
    const writing = first.write({ optimistic: rename("pending"), submit: () => submit.promise });
    await second.write({ submit: submitSuccess });
    expect(first.queryFn).not.toHaveBeenCalled();
    expect(first.cachedTeam()?.name).toBe("pending");
    expect(second.queryFn).toHaveBeenCalledTimes(1);
    expect(second.cachedTeam()?.name).toBe("server");
    submit.resolve(succeeded);
    await writing;
    expect(first.queryFn).toHaveBeenCalledTimes(1);
    first.dispose();
    second.dispose();
  });

  it("keeps writes to the same team independent across query clients", async () => {
    const first = setup();
    const second = setup();
    const submit = Promise.withResolvers<ActionResult<undefined>>();
    const writing = first.write({ submit: () => submit.promise });
    await second.write({ submit: submitSuccess });
    expect(first.queryFn).not.toHaveBeenCalled();
    expect(second.queryFn).toHaveBeenCalledTimes(1);
    submit.resolve(succeeded);
    await writing;
    expect(first.queryFn).toHaveBeenCalledTimes(1);
    first.dispose();
    second.dispose();
  });

  it("fetches again for a live event arriving during the canonical refresh", async () => {
    const state = setup();
    const invalidator = createTeamQueryInvalidator(state.queryClient, "team-1");
    const refetch = Promise.withResolvers<TeamQueryData>();
    state.queryFn.mockReturnValueOnce(refetch.promise);
    const writing = state.write({ submit: submitSuccess });
    await vi.advanceTimersByTimeAsync(0);
    invalidator.notify();
    await vi.advanceTimersByTimeAsync(250);
    expect(state.queryFn).toHaveBeenCalledTimes(1);
    refetch.resolve({ team: makeTeam("before-live-event") });
    await writing;
    await vi.advanceTimersByTimeAsync(0);
    expect(state.queryFn).toHaveBeenCalledTimes(2);
    expect(state.cachedTeam()?.name).toBe("server");
    invalidator.dispose();
    state.dispose();
  });

  it("replaces an older fetch when a new write wave finishes", async () => {
    const state = setup();
    const older = Promise.withResolvers<TeamQueryData>();
    const latest = Promise.withResolvers<TeamQueryData>();
    state.queryFn.mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    const first = state.write({ submit: submitSuccess });
    await vi.advanceTimersByTimeAsync(0);
    const second = state.write({ submit: submitSuccess });
    await vi.advanceTimersByTimeAsync(0);
    expect(state.queryFn).toHaveBeenCalledTimes(2);
    latest.resolve({ team: makeTeam("latest") });
    await Promise.all([first, second]);
    older.resolve({ team: makeTeam("stale") });
    await vi.advanceTimersByTimeAsync(0);
    expect(state.cachedTeam()?.name).toBe("latest");
    state.dispose();
  });
});
