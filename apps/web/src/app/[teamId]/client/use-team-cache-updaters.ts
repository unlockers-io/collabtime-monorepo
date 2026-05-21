"use client";

import { useCallback } from "react";

import { useUpdateTeamCache } from "@/hooks/use-team-query";
import type { TeamGroup, TeamMember } from "@/types";

const useTeamCacheUpdaters = (teamId: string) => {
  const updateTeamCache = useUpdateTeamCache();

  const handleMemberAdded = useCallback(
    (newMember: TeamMember) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        if (prev.team.members.some((m) => m.id === newMember.id)) {
          return prev;
        }
        return {
          ...prev,
          team: {
            ...prev.team,
            members: [...prev.team.members, newMember],
          },
        };
      });
    },
    [teamId, updateTeamCache],
  );

  const handleMemberRemoved = useCallback(
    (memberId: string) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          team: {
            ...prev.team,
            members: prev.team.members.filter((m) => m.id !== memberId),
          },
        };
      });
    },
    [teamId, updateTeamCache],
  );

  const handleMemberUpdated = useCallback(
    (updatedMember: TeamMember) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          team: {
            ...prev.team,
            members: prev.team.members.map((m) => (m.id === updatedMember.id ? updatedMember : m)),
          },
        };
      });
    },
    [teamId, updateTeamCache],
  );

  const handleMembersImported = useCallback(
    (newMembers: Array<TeamMember>) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        const existingIds = new Set(prev.team.members.map((m) => m.id));
        const toAdd = newMembers.filter((m) => !existingIds.has(m.id));
        if (toAdd.length === 0) {
          return prev;
        }
        return {
          ...prev,
          team: {
            ...prev.team,
            members: [...prev.team.members, ...toAdd],
          },
        };
      });
    },
    [teamId, updateTeamCache],
  );

  const handleTeamNameUpdated = useCallback(
    (name: string) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          team: { ...prev.team, name },
        };
      });
    },
    [teamId, updateTeamCache],
  );

  const handleGroupAdded = useCallback(
    (newGroup: TeamGroup) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        if (prev.team.groups.some((g) => g.id === newGroup.id)) {
          return prev;
        }
        return {
          ...prev,
          team: {
            ...prev.team,
            groups: [...prev.team.groups, newGroup],
          },
        };
      });
    },
    [teamId, updateTeamCache],
  );

  const handleGroupUpdated = useCallback(
    (updatedGroup: TeamGroup) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          team: {
            ...prev.team,
            groups: prev.team.groups.map((g) => (g.id === updatedGroup.id ? updatedGroup : g)),
          },
        };
      });
    },
    [teamId, updateTeamCache],
  );

  const handleGroupRemoved = useCallback(
    (groupId: string) => {
      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          team: {
            ...prev.team,
            groups: prev.team.groups.filter((g) => g.id !== groupId),
            members: prev.team.members.map((m) =>
              m.groupId === groupId ? { ...m, groupId: undefined } : m,
            ),
          },
        };
      });
    },
    [teamId, updateTeamCache],
  );

  return {
    handleGroupAdded,
    handleGroupRemoved,
    handleGroupUpdated,
    handleMemberAdded,
    handleMemberRemoved,
    handleMembersImported,
    handleMemberUpdated,
    handleTeamNameUpdated,
    updateTeamCache,
  };
};

export { useTeamCacheUpdaters };
