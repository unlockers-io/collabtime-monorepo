"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@repo/ui/lib/utils";

import { GroupCard } from "@/components/group-card";
import type { TeamGroup } from "@/types";

type SortableGroupCardProps = {
  canEdit: boolean;
  group: TeamGroup;
  isDropTarget?: boolean;
  memberCount: number;
  teamId: string;
};

const SortableGroupCard = (props: SortableGroupCardProps) => {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: props.group.id,
  });

  const style = {
    "--sortable-group-card-opacity": isDragging ? 0.5 : 1,
    "--sortable-group-card-transform": CSS.Translate.toString(transform),
    "--sortable-group-card-transition": transition,
  };

  return (
    <div
      className={cn("sortable-group-geometry", isDragging ? "cursor-grabbing" : "cursor-grab")}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable item, press Space to lift"
    >
      <GroupCard {...props} />
    </div>
  );
};

export { SortableGroupCard };
