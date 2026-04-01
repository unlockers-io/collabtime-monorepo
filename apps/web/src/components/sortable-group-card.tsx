"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { GroupCard } from "@/components/group-card";
import type { TeamGroup } from "@/types";

type SortableGroupCardProps = {
  canEdit: boolean;
  group: TeamGroup;
  isDropTarget?: boolean;
  memberCount: number;
  onGroupRemoved: (groupId: string) => void;
  onGroupUpdated: (group: TeamGroup) => void;
  teamId: string;
};

const SortableGroupCard = (props: SortableGroupCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.group.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "cursor-grabbing" : "cursor-grab"}
      {...attributes}
      {...listeners}
    >
      <GroupCard {...props} />
    </div>
  );
};

export { SortableGroupCard };
