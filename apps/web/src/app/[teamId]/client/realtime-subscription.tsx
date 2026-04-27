"use client";

import { toast } from "sonner";

import type { useUpdateTeamCache } from "@/hooks/use-team-query";
import { useRealtime } from "@/lib/realtime-client";
import type { TeamGroup, TeamMember } from "@/types";

type RealtimeSubscriptionProps = {
  lastRemovalRef: React.RefObject<{ id: string; ts: number }>;
  teamId: string;
  updateTeamCache: ReturnType<typeof useUpdateTeamCache>;
};

const RealtimeSubscription = ({
  lastRemovalRef,
  teamId,
  updateTeamCache,
}: RealtimeSubscriptionProps) => {
  useRealtime({
    channels: [`team-${teamId}`],
    events: [
      "team.memberAdded",
      "team.memberRemoved",
      "team.memberUpdated",
      "team.membersImported",
      "team.membersReordered",
      "team.nameUpdated",
      "team.groupCreated",
      "team.groupUpdated",
      "team.groupRemoved",
      "team.groupsReordered",
    ],
    onData({ data, event }) {
      if (event === "team.memberAdded") {
        const newMember = data as TeamMember;
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
        toast.success(`${newMember.name} joined the team`, {
          id: `member-added-${newMember.id}`,
        });
      } else if (event === "team.memberRemoved") {
        const { memberId } = data as { memberId: string };
        if (
          lastRemovalRef.current.id === memberId &&
          Date.now() - lastRemovalRef.current.ts < 1500
        ) {
          return;
        }
        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          const member = prev.team.members.find((m) => m.id === memberId);
          if (member) {
            lastRemovalRef.current = { id: memberId, ts: Date.now() };
            toast.success(`${member.name} left the team`, {
              id: `member-removed-${memberId}`,
            });
          }
          return {
            ...prev,
            team: {
              ...prev.team,
              members: prev.team.members.filter((m) => m.id !== memberId),
            },
          };
        });
      } else if (event === "team.memberUpdated") {
        const updatedMember = data as TeamMember;
        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            team: {
              ...prev.team,
              members: prev.team.members.map((m) =>
                m.id === updatedMember.id ? updatedMember : m,
              ),
            },
          };
        });
      } else if (event === "team.membersImported") {
        const newMembers = data as Array<TeamMember>;
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
      } else if (event === "team.membersReordered") {
        const { order } = data as { order: Array<string> };
        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          const map = new Map(prev.team.members.map((m) => [m.id, m]));
          return {
            ...prev,
            team: {
              ...prev.team,
              members: order
                .map((id, index) => {
                  const member = map.get(id);
                  return member ? Object.assign(member, { order: index }) : null;
                })
                .filter(Boolean) as Array<TeamMember>,
            },
          };
        });
      } else if (event === "team.nameUpdated") {
        const { name } = data as { name: string };
        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            team: { ...prev.team, name },
          };
        });
      } else if (event === "team.groupCreated") {
        const newGroup = data as TeamGroup;
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
      } else if (event === "team.groupUpdated") {
        const updatedGroup = data as TeamGroup;
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
      } else if (event === "team.groupRemoved") {
        const { groupId } = data as { groupId: string };
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
      } else if (event === "team.groupsReordered") {
        const { order } = data as { order: Array<string> };
        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          const map = new Map(prev.team.groups.map((g) => [g.id, g]));
          return {
            ...prev,
            team: {
              ...prev.team,
              groups: order
                .map((id, index) => {
                  const group = map.get(id);
                  return group ? Object.assign(group, { order: index }) : null;
                })
                .filter(Boolean) as Array<TeamGroup>,
            },
          };
        });
      }
    },
  });

  return null;
};

export { RealtimeSubscription };
