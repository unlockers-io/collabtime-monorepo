"use client";

import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { FolderKanban } from "lucide-react";

import { GroupCard } from "@/components/group-card";
import { SortableGroupCard } from "@/components/sortable-group-card";
import type { TeamGroup, TeamMember } from "@/types";

type GroupsGridProps = {
  activeDragType: "group" | "member" | null;
  isAdmin: boolean;
  members: Array<TeamMember>;
  onGroupRemoved: (groupId: string) => void;
  onGroupUpdated: (group: TeamGroup) => void;
  orderedGroups: Array<TeamGroup>;
  teamId: string;
};

const GroupsGrid = ({
  activeDragType,
  isAdmin,
  members,
  onGroupRemoved,
  onGroupUpdated,
  orderedGroups,
  teamId,
}: GroupsGridProps) => {
  if (orderedGroups.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-muted/50 px-6 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
          <FolderKanban className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-foreground">Organize with groups</h3>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Create groups to organize team members by department, project, or location. Drag and
            drop members into groups to categorize them.
          </p>
        </div>
      </div>
    );
  }

  const groupIds = orderedGroups.map((g) => g.id);

  return (
    <ScrollArea className="max-h-150">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,320px))] gap-4 pr-4">
        {isAdmin ? (
          <SortableContext items={groupIds} strategy={rectSortingStrategy}>
            {orderedGroups.map((group) => (
              <SortableGroupCard
                canEdit={isAdmin}
                group={group}
                isDropTarget={activeDragType === "member"}
                key={group.id}
                memberCount={members.filter((m) => m.groupId === group.id).length}
                onGroupRemoved={onGroupRemoved}
                onGroupUpdated={onGroupUpdated}
                teamId={teamId}
              />
            ))}
          </SortableContext>
        ) : (
          orderedGroups.map((group) => (
            <GroupCard
              canEdit={false}
              group={group}
              key={group.id}
              memberCount={members.filter((m) => m.groupId === group.id).length}
              onGroupRemoved={onGroupRemoved}
              onGroupUpdated={onGroupUpdated}
              teamId={teamId}
            />
          ))
        )}
      </div>
    </ScrollArea>
  );
};

export { GroupsGrid };
