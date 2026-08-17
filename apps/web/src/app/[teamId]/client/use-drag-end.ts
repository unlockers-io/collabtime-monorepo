"use client";

import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "@repo/ui/components/sonner";

import type { TeamCacheUpdater, useTeamMutation } from "@/hooks/use-team-query";
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
  teamMutation: ReturnType<typeof useTeamMutation>;
};

type Orderable = { id: string; order: number };

/**
 * Member and group reordering differ only in which collection they touch. Ids
 * the cache no longer knows are dropped rather than fabricated, since the cache
 * can move on while a drag is in flight.
 */
const reorderPatch =
  (key: "groups" | "members", newIds: Array<string>): TeamCacheUpdater =>
  (prev) => {
    if (!prev) {
      return prev;
    }

    const byId = new Map<string, Orderable>(prev.team[key].map((item) => [item.id, item]));

    return {
      ...prev,
      team: {
        ...prev.team,
        [key]: newIds.flatMap((id, index) => {
          const item = byId.get(id);
          return item ? [{ ...item, order: index }] : [];
        }),
      },
    };
  };

const indexPair = (items: Array<{ id: string }>, activeId: string, overId: string) => {
  const oldIndex = items.findIndex((item) => item.id === activeId);
  const newIndex = items.findIndex((item) => item.id === overId);
  return oldIndex === -1 || newIndex === -1 ? null : { newIndex, oldIndex };
};

const useDragEnd = ({
  groups,
  isAdmin,
  members,
  orderedGroups,
  orderedMembers,
  teamId,
  teamMutation,
}: UseDragEndArgs) => {
  const handleMemberDroppedOnGroup = (memberId: string, groupId: string) => {
    if (!isAdmin) {
      toast.error("Admin access required");
      return;
    }

    const member = members.find((m) => m.id === memberId);
    if (!member || member.groupId === groupId) {
      return;
    }

    const groupName = groups.find((g) => g.id === groupId)?.name ?? "group";

    teamMutation.mutate(
      {
        optimistic: (prev) =>
          prev === null
            ? prev
            : {
                ...prev,
                team: {
                  ...prev.team,
                  members: prev.team.members.map((m) =>
                    m.id === memberId ? { ...m, groupId } : m,
                  ),
                },
              },
        submit: () => updateMember(teamId, memberId, { groupId }),
      },
      {
        onError: (error) => {
          toast.error(error.message);
        },
        onSuccess: () => {
          toast.success(`${member.name} added to ${groupName}`);
        },
      },
    );
  };

  const reorder = (key: "groups" | "members", newIds: Array<string>) => {
    teamMutation.mutate(
      {
        optimistic: reorderPatch(key, newIds),
        submit: () =>
          key === "members" ? reorderMembers(teamId, newIds) : reorderGroups(teamId, newIds),
      },
      {
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  const handleDragEnd = (event: DragEndEvent, dragType: "group" | "member" | null) => {
    const { active, over } = event;

    if (!over || !isAdmin) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) {
      return;
    }

    if (dragType === "member") {
      if (orderedMembers.some((m) => m.id === overId)) {
        const pair = indexPair(orderedMembers, activeId, overId);
        if (pair) {
          reorder(
            "members",
            arrayMove(orderedMembers, pair.oldIndex, pair.newIndex).map((m) => m.id),
          );
        }
        return;
      }

      if (orderedGroups.some((g) => g.id === overId)) {
        handleMemberDroppedOnGroup(activeId, overId);
      }
      return;
    }

    if (dragType === "group") {
      const pair = indexPair(orderedGroups, activeId, overId);
      if (pair) {
        reorder(
          "groups",
          arrayMove(orderedGroups, pair.oldIndex, pair.newIndex).map((g) => g.id),
        );
      }
    }
  };

  return { handleDragEnd };
};

export { useDragEnd };
