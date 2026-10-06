import type { QueryClient } from "@tanstack/react-query";

import { queryKeys, teamMutationKey } from "./query-keys";

const createTeamQueryInvalidator = (queryClient: QueryClient, teamId: string) => {
  const queryKey = queryKeys.teams.detail(teamId);
  const mutationKey = teamMutationKey(teamId);
  let pending = false;
  let running = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = async () => {
    if (disposed || !pending || running || timer !== undefined) {
      return;
    }
    if (queryClient.isMutating({ mutationKey }) > 0) {
      // Team writes refetch once the last one settles, which is after this change arrived.
      pending = false;
      return;
    }
    if (queryClient.isFetching({ exact: true, queryKey }) > 0) {
      return;
    }
    pending = false;
    running = true;
    try {
      await queryClient.invalidateQueries({ exact: true, queryKey }, { cancelRefetch: false });
    } finally {
      running = false;
      void flush();
    }
  };
  const settled = () => {
    if (pending && !disposed) {
      queueMicrotask(() => {
        void flush();
      });
    }
  };
  const unsubscribeQuery = queryClient.getQueryCache().subscribe(settled);
  const unsubscribeMutation = queryClient.getMutationCache().subscribe(settled);

  return {
    dispose: () => {
      disposed = true;
      clearTimeout(timer);
      unsubscribeQuery();
      unsubscribeMutation();
    },
    notify: () => {
      if (disposed) {
        return;
      }
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void flush();
      }, 250);
    },
  };
};

export { createTeamQueryInvalidator };
