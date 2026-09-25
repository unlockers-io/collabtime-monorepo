import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, assert, expect, it, vi } from "vitest";

import { useTeamLiveSync } from "./use-team-live-sync";

class FakeEventSource extends EventTarget {
  static instances: Array<FakeEventSource> = [];
  close = vi.fn<() => void>();
  constructor() {
    super();
    FakeEventSource.instances.push(this);
  }
}

const queryClient = new QueryClient();
const Wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

afterEach(() => {
  vi.unstubAllGlobals();
  queryClient.clear();
  FakeEventSource.instances = [];
});

it("connects two consumers to one source and refreshes the route on revoked", () => {
  vi.stubGlobal("EventSource", FakeEventSource);
  const refresh = vi.fn<() => void>();
  const first = renderHook(() => useTeamLiveSync({ refresh, teamId: "hook-team" }), {
    wrapper: Wrapper,
  });
  const second = renderHook(() => useTeamLiveSync({ refresh, teamId: "hook-team" }), {
    wrapper: Wrapper,
  });
  expect(FakeEventSource.instances).toHaveLength(1);
  const [source] = FakeEventSource.instances;
  assert(source, "expected one EventSource");
  act(() => {
    source.dispatchEvent(new Event("ready"));
  });
  expect(first.result.current).toBe("live");
  expect(second.result.current).toBe("live");
  first.unmount();
  expect(source.close).not.toHaveBeenCalled();
  act(() => {
    source.dispatchEvent(new Event("revoked"));
  });
  expect(second.result.current).toBe("offline");
  expect(refresh).toHaveBeenCalledTimes(1);
  second.unmount();
  expect(source.close).toHaveBeenCalledTimes(1);
});

it("does not construct EventSource when disabled", () => {
  vi.stubGlobal("EventSource", FakeEventSource);
  const hook = renderHook(
    () =>
      useTeamLiveSync({ enabled: false, refresh: vi.fn<() => void>(), teamId: "disabled-team" }),
    { wrapper: Wrapper },
  );
  expect(hook.result.current).toBe("offline");
  expect(FakeEventSource.instances).toHaveLength(0);
  hook.unmount();
});
