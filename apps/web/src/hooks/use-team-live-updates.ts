"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

import { createTeamLiveRegistry, type LiveSyncStatus } from "@/lib/team-live-connection";
import { createTeamQueryInvalidator } from "@/lib/team-query-sync";

const registry = createTeamLiveRegistry({
  checkAccess: async (url, signal) => {
    const response = await fetch(url, { cache: "no-store", method: "HEAD", signal });
    return response.status;
  },
  createSource: (url) => new EventSource(url),
  isVisible: () => document.visibilityState === "visible",
  onVisibilityChange: (callback) => {
    document.addEventListener("visibilitychange", callback);
    return () => {
      document.removeEventListener("visibilitychange", callback);
    };
  },
  random: Math.random,
});

const getServerSnapshot = (): LiveSyncStatus => "offline";
const unsubscribeDisabled = () => undefined;

const useTeamLiveUpdates = ({
  enabled = true,
  refresh,
  teamId,
}: {
  enabled?: boolean;
  refresh: () => void;
  teamId: string;
}): LiveSyncStatus => {
  const queryClient = useQueryClient();
  const subscribe = useCallback(
    (onStatus: () => void) => {
      if (!enabled) {
        return unsubscribeDisabled;
      }
      const sync = createTeamQueryInvalidator(queryClient, teamId);
      const release = registry.subscribe(teamId, {
        change: sync.notify,
        space: refresh,
        status: onStatus,
        terminal: () => {
          sync.dispose();
          refresh();
        },
      });
      return () => {
        release();
        sync.dispose();
      };
    },
    [enabled, queryClient, refresh, teamId],
  );
  const getSnapshot = useCallback(
    () => (enabled ? registry.getStatus(teamId) : "offline"),
    [enabled, teamId],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

export { useTeamLiveUpdates };
