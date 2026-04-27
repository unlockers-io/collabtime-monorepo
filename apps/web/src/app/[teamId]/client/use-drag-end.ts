"use client";

import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";

import type { useUpdateTeamCache } from "@/hooks/use-team-query";
import { reorderGroups } from "@/lib/actions/group-actions";
import { reorderMembers, updateMember } from "@/lib/actions/member-actions";
import type { TeamGroup, TeamMember } from "@/types";

type UseDragEndArgs = {
  groups: Array<TeamGroup>;
  isAdmin: boolean;
  members: Array<TeamMember>;
  orderedGroups: Array<TeamGroup>;
  orderedMembers: Array<TeamMember>;
  teamId: string;
  updateTeamCache: ReturnType<typeof useUpdateTeamCache>;
};

const useDragEnd = ({
  groups,
  isAdmin,
  members,
  orderedGroups,
  orderedMembers,
  teamId,
  updateTeamCache,
}: UseDragEndArgs) => {
  const handleMemberDroppedOnGroup = async (memberId: string, groupId: string) => {
    if (!isAdmin) {
      toast.error("Admin access required");
      return;
    }

    const member = members.find((m) => m.id === memberId);
    if (!member) {
      return;
    }

    if (member.groupId === groupId) {
      return;
    }

    const previousGroupId = member.groupId;

    // Optimistic update
    updateTeamCache(teamId, (prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        team: {
          ...prev.team,
          members: prev.team.members.map((m) => (m.id === memberId ? { ...m, groupId } : m)),
        },
      };
    });

    const result = await updateMember(teamId, memberId, { groupId });

    if (result.success) {
      const group = groups.find((g) => g.id === groupId);
      toast.success(`${member.name} added to ${group?.name ?? "group"}`);
    } else {
      // Revert on failure
      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          team: {
            ...prev.team,
            members: prev.team.members.map((m) =>
              m.id === memberId ? { ...m, groupId: previousGroupId } : m,
            ),
          },
        };
      });
      toast.error(result.error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent, dragType: "group" | "member" | null) => {
    const { active, over } = event;

    if (!over || !isAdmin) {
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) {
      return;
    }

    if (dragType === "member") {
      const overIsMember = orderedMembers.some((m) => m.id === overId);
      if (overIsMember) {
        const oldIndex = orderedMembers.findIndex((m) => m.id === activeId);
        const newIndex = orderedMembers.findIndex((m) => m.id === overId);
        if (oldIndex === -1 || newIndex === -1) {
          return;
        }

        const newOrder = arrayMove(orderedMembers, oldIndex, newIndex);
        const newIds = newOrder.map((m) => m.id);

        updateTeamCache(teamId, (prev) => {
          if (!prev) {
            return prev;
          }
          const map = new Map(prev.team.members.map((m) => [m.id, m]));
          return {
            ...prev,
            team: {
              ...prev.team,
              members: newIds.flatMap((id, i) => {
                const member = map.get(id);
                return member ? [{ ...member, order: i }] : [];
              }),
            },
          };
        });

        const result = await reorderMembers(teamId, newIds);
        if (!result.success) {
          toast.error(result.error);
        }
      } else {
        const overIsGroup = orderedGroups.some((g) => g.id === overId);
        if (overIsGroup) {
          handleMemberDroppedOnGroup(activeId, overId);
        }
      }
    } else if (dragType === "group") {
      const oldIndex = orderedGroups.findIndex((g) => g.id === activeId);
      const newIndex = orderedGroups.findIndex((g) => g.id === overId);
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const newOrder = arrayMove(orderedGroups, oldIndex, newIndex);
      const newIds = newOrder.map((g) => g.id);

      updateTeamCache(teamId, (prev) => {
        if (!prev) {
          return prev;
        }
        const map = new Map(prev.team.groups.map((g) => [g.id, g]));
        return {
          ...prev,
          team: {
            ...prev.team,
            groups: newIds.flatMap((id, i) => {
              const group = map.get(id);
              return group ? [{ ...group, order: i }] : [];
            }),
          },
        };
      });

      const result = await reorderGroups(teamId, newIds);
      if (!result.success) {
        toast.error(result.error);
      }
    }
  };

  return { handleDragEnd };
};

export { useDragEnd };
