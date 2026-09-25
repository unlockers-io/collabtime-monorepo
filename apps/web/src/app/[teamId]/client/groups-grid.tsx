"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { GroupCard } from "@/components/group-card";
import { SortableGroupCard } from "@/components/sortable-group-card";
import type { TeamGroup, TeamMember } from "@/types";

type GroupsGridProps = {
  activeDragType: "group" | "member" | null;
  isAdmin: boolean;
  members: Array<TeamMember>;
  orderedGroups: Array<TeamGroup>;
  teamId: string;
};

const GroupsGrid = ({
  activeDragType,
  isAdmin,
  members,
  orderedGroups,
  teamId,
}: GroupsGridProps) => {
  if (orderedGroups.length === 0) {
    return (
      <div className="flex flex-col gap-1 border-y border-border py-8">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-foreground">Organize with groups</h3>
          <p className="max-w-md text-sm text-pretty text-muted-foreground">
            Create groups to organize team members by department, project, or location. Drag and
            drop members into groups to categorize them.
          </p>
        </div>
      </div>
    );
  }

  const groupIds = orderedGroups.map((g) => g.id);

  return (
    <div className="flex flex-col divide-y divide-border border-y border-border">
      {isAdmin ? (
        <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
          {orderedGroups.map((group) => (
            <SortableGroupCard
              canEdit={isAdmin}
              group={group}
              isDropTarget={activeDragType === "member"}
              key={group.id}
              memberCount={members.filter((m) => m.groupId === group.id).length}
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
            teamId={teamId}
          />
        ))
      )}
    </div>
  );
};

export { GroupsGrid };
