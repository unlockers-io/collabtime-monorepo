"use client";

import {
  defaultAnimateLayoutChanges,
  useSortable,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
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

const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { isSorting, wasDragging } = args;
  if (isSorting || wasDragging) {
    return false;
  }
  return defaultAnimateLayoutChanges(args);
};

const SortableGroupCard = (props: SortableGroupCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.group.id,
    animateLayoutChanges,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
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
