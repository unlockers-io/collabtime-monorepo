"use client";

import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";

import { useTeamWrite } from "@/hooks/use-team-write";
import { reorderGroups } from "@/lib/actions/group-actions";
import { reorderMembers, updateMember } from "@/lib/actions/member-actions";
import type { ActionResult } from "@/lib/actions/types";
import type { Team, TeamGroup, TeamMember } from "@/types";

type UseDragEndArgs = {
  orderedGroups: Array<TeamGroup>;
  orderedMembers: Array<TeamMember>;
  teamId: string;
};

type Orderable = { id: string; order: number };

/**
 * Member and group reordering differ only in which collection they touch. Ids
 * the cache no longer knows are dropped rather than fabricated, since the cache
 * can move on while a drag is in flight.
 */
const reorderPatch =
  (key: "groups" | "members", newIds: Array<string>) =>
  (team: Team): Team => {
    const byId = new Map<string, Orderable>(team[key].map((item) => [item.id, item]));

    return {
      ...team,
      [key]: newIds.flatMap((id, index) => {
        const item = byId.get(id);
        return item ? [{ ...item, order: index }] : [];
      }),
    };
  };

const indexPair = (items: Array<{ id: string }>, activeId: string, overId: string) => {
  const oldIndex = items.findIndex((item) => item.id === activeId);
  const newIndex = items.findIndex((item) => item.id === overId);
  return oldIndex === -1 || newIndex === -1 ? null : { newIndex, oldIndex };
};

const useDragEnd = ({ orderedGroups, orderedMembers, teamId }: UseDragEndArgs) => {
  const writeTeam = useTeamWrite(teamId);

  const write = async (
    optimistic: (team: Team) => Team,
    submit: () => Promise<ActionResult<unknown>>,
    successMessage?: string,
  ) => {
    try {
      const result = await writeTeam({ optimistic, submit });
      if (!result.success) {
        toast.error(result.error);
      } else if (successMessage !== undefined) {
        toast.success(successMessage);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the change");
    }
  };

  const handleMemberDroppedOnGroup = (memberId: string, groupId: string) => {
    const member = orderedMembers.find((m) => m.id === memberId);
    if (!member || member.groupId === groupId) {
      return;
    }

    const groupName = orderedGroups.find((g) => g.id === groupId)?.name ?? "group";

    void write(
      (team) => ({
        ...team,
        members: team.members.map((m) => (m.id === memberId ? { ...m, groupId } : m)),
      }),
      () => updateMember(teamId, memberId, { groupId }),
      `${member.name} added to ${groupName}`,
    );
  };

  const reorder = (key: "groups" | "members", newIds: Array<string>) => {
    void write(reorderPatch(key, newIds), () =>
      key === "members" ? reorderMembers(teamId, newIds) : reorderGroups(teamId, newIds),
    );
  };

  const handleDragEnd = (event: DragEndEvent, dragType: "group" | "member" | null) => {
    const { active, over } = event;

    if (!over) {
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
