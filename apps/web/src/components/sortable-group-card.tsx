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
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: props.group.id,
  });

  const style = {
    opacity: isDragging ? 0.5 : 1,
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      className={isDragging ? "cursor-grabbing" : "cursor-grab"}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <GroupCard {...props} />
    </div>
  );
};

export { SortableGroupCard };
