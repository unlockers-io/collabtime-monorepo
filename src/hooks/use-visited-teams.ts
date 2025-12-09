import { useCallback, useEffect, useState } from "react";
import { useLocalStorage } from "./use-local-storage";
import { validateTeam } from "@/lib/actions";

const STORAGE_KEY = "collab-time-visited-teams";
const MAX_VISITED_TEAMS = 10;

type VisitedTeam = {
  id: string;
  name: string;
  memberCount: number;
  lastVisited: string;
};

const useVisitedTeams = () => {
  const [visitedTeams, setVisitedTeams] = useLocalStorage<VisitedTeam[]>(
    STORAGE_KEY,
    []
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsHydrated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!isHydrated || visitedTeams.length === 0) return;

    let cancelled = false;
    const runValidation = async () => {
      try {
        const results = await Promise.all(
          visitedTeams.map(async (team) => {
            const exists = await validateTeam(team.id);
            return { id: team.id, exists };
          })
        );

        if (cancelled) return;
        const invalidIds = results.filter((r) => !r.exists).map((r) => r.id);
        if (invalidIds.length > 0) {
          setVisitedTeams((teams) => teams.filter((t) => !invalidIds.includes(t.id)));
        }
      } catch {
        // ignore validation failures; keep current list
      }
    };

    runValidation();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, visitedTeams, setVisitedTeams]);

  const saveVisitedTeam = useCallback(
    (teamId: string, memberCount: number, name?: string) => {
      setVisitedTeams((teams) => {
        const existingTeam = teams.find((t) => t.id === teamId);

        const visitedTeam: VisitedTeam = {
          id: teamId,
          name: name ?? existingTeam?.name ?? "",
          memberCount,
          lastVisited: new Date().toISOString(),
        };

        const newTeams = teams.filter((t) => t.id !== teamId);

        // Add to the beginning (most recent first)
        newTeams.unshift(visitedTeam);

        // Keep only the most recent teams
        return newTeams.slice(0, MAX_VISITED_TEAMS);
      });
    },
    [setVisitedTeams]
  );

  const updateTeamName = useCallback(
    (teamId: string, name: string) => {
      setVisitedTeams((teams) =>
        teams.map((t) => (t.id === teamId ? { ...t, name } : t))
      );
    },
    [setVisitedTeams]
  );

  const removeVisitedTeam = useCallback(
    (teamId: string) => {
      setVisitedTeams((teams) => teams.filter((t) => t.id !== teamId));
    },
    [setVisitedTeams]
  );

  const getTeamName = useCallback(
    (teamId: string) => {
      return visitedTeams.find((t) => t.id === teamId)?.name ?? "";
    },
    [visitedTeams]
  );

  return {
    visitedTeams,
    isHydrated,
    saveVisitedTeam,
    updateTeamName,
    removeVisitedTeam,
    getTeamName,
  };
};

export { useVisitedTeams };
export type { VisitedTeam };
