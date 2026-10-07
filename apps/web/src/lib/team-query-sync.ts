import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "./query-keys";

const createTeamCoordinator = (queryClient: QueryClient, teamId: string) => {
  const queryKey = queryKeys.teams.detail(teamId);
  let writes = 0;
  let subscribers = 0;
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clearPending = () => {
    pending = false;
    clearTimeout(timer);
    timer = undefined;
  };

  const refresh = () => {
    clearPending();
    return queryClient.invalidateQueries({ exact: true, queryKey });
  };

  const flush = () => {
    if (!pending || timer !== undefined || writes > 0) {
      return;
    }
    if (queryClient.isFetching({ exact: true, queryKey }) === 0) {
      void refresh();
    }
  };

  return {
    beginWrite: () => {
      writes += 1;
      return async () => {
        writes -= 1;
        if (writes === 0) {
          // A fresh fetch covers every completed write and preceding live event.
          await refresh();
        }
      };
    },
    subscribe: () => {
      subscribers += 1;
      let disposed = false;
      const unsubscribe = queryClient.getQueryCache().subscribe(() => {
        if (pending) {
          queueMicrotask(flush);
        }
      });
      return {
        dispose: () => {
          if (disposed) {
            return;
          }
          disposed = true;
          unsubscribe();
          subscribers -= 1;
          if (subscribers === 0) {
            clearPending();
          }
        },
        notify: () => {
          if (disposed) {
            return;
          }
          pending = true;
          clearTimeout(timer);
          timer = setTimeout(() => {
            timer = undefined;
            flush();
          }, 250);
        },
      };
    },
  };
};

const clients = new WeakMap<QueryClient, Map<string, ReturnType<typeof createTeamCoordinator>>>();

const getTeamCoordinator = (queryClient: QueryClient, teamId: string) => {
  let teams = clients.get(queryClient);
  if (!teams) {
    teams = new Map();
    clients.set(queryClient, teams);
  }
  let sync = teams.get(teamId);
  if (!sync) {
    sync = createTeamCoordinator(queryClient, teamId);
    teams.set(teamId, sync);
  }
  return sync;
};

const beginTeamWrite = (queryClient: QueryClient, teamId: string) =>
  getTeamCoordinator(queryClient, teamId).beginWrite();

const createTeamQueryInvalidator = (queryClient: QueryClient, teamId: string) =>
  getTeamCoordinator(queryClient, teamId).subscribe();

export { beginTeamWrite, createTeamQueryInvalidator };
