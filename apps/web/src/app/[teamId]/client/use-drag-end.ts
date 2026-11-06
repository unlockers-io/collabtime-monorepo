"use client";

import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";

import { useTeamWrite } from "@/hooks/use-team-write";
import type { ActionResult } from "@/lib/actions/types";
import type { TeamGroup, TeamMember } from "@/types";

type UseDragEndArgs = {
  orderedGroups: Array<TeamGroup>;
  orderedMembers: Array<TeamMember>;
  teamId: string;
};

const report = async (writing: Promise<ActionResult<undefined>>, successMessage?: string) => {
  const result = await writing;

  if (!result.success) {
    toast.error(result.error);
  } else if (successMessage !== undefined) {
    toast.success(successMessage);
  }
};

const indexPair = (items: Array<{ id: string }>, activeId: string, overId: string) => {
  const oldIndex = items.findIndex((item) => item.id === activeId);
  const newIndex = items.findIndex((item) => item.id === overId);

  return oldIndex === -1 || newIndex === -1 ? null : { newIndex, oldIndex };
};

const useDragEnd = ({ orderedGroups, orderedMembers, teamId }: UseDragEndArgs) => {
  const write = useTeamWrite(teamId);

  const handleMemberDroppedOnGroup = (memberId: string, groupId: string) => {
    const member = orderedMembers.find((m) => m.id === memberId);

    if (!member || member.groupId === groupId) {
      return;
    }

    const groupName = orderedGroups.find((g) => g.id === groupId)?.name ?? "group";

    void report(
      write.change("updateMember", { memberId, updates: { groupId } }),
      `${member.name} added to ${groupName}`,
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
          void report(
            write.change("reorderMembers", {
              memberIds: arrayMove(orderedMembers, pair.oldIndex, pair.newIndex).map((m) => m.id),
            }),
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
        void report(
          write.change("reorderGroups", {
            groupIds: arrayMove(orderedGroups, pair.oldIndex, pair.newIndex).map((g) => g.id),
          }),
        );
      }
    }
  };

  return { handleDragEnd };
};

export { useDragEnd };
