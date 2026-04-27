"use client";

import { useUpdateTeamCache } from "@/hooks/use-team-query";
import type { TeamGroup, TeamMember } from "@/types";

const useTeamCacheUpdaters = (teamId: string) => {
  const updateTeamCache = useUpdateTeamCache();

  const handleMemberAdded = (newMember: TeamMember) => {
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
  };

  const handleMemberRemoved = (memberId: string) => {
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
  };

  const handleMemberUpdated = (updatedMember: TeamMember) => {
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
  };

  const handleGroupAdded = (newGroup: TeamGroup) => {
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
  };

  const handleGroupUpdated = (updatedGroup: TeamGroup) => {
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
  };

  const handleGroupRemoved = (groupId: string) => {
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
  };

  return {
    handleGroupAdded,
    handleGroupRemoved,
    handleGroupUpdated,
    handleMemberAdded,
    handleMemberRemoved,
    handleMemberUpdated,
    updateTeamCache,
  };
};

export { useTeamCacheUpdaters };
