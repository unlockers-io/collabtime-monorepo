"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { GroupCard } from "@/components/group-card";
import type { TeamGroup } from "@/types";

const DRAG_HANDLE_CLASS =
  "flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing";

type SortableGroupCardProps = {
  canEdit: boolean;
  group: TeamGroup;
  isDropTarget?: boolean;
  memberCount: number;
  teamId: string;
};

const SortableGroupCard = (props: SortableGroupCardProps) => {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: props.group.id });

  const style = {
    "--sortable-group-card-opacity": isDragging ? 0.5 : 1,
    "--sortable-group-card-transform": CSS.Translate.toString(transform),
    "--sortable-group-card-transition": transition,
  };

  return (
    <div className="sortable-group-geometry" ref={setNodeRef} style={style}>
      <GroupCard
        {...props}
        dragHandle={
          <button
            className={DRAG_HANDLE_CLASS}
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Move ${props.group.name}`}
            aria-roledescription="draggable"
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </div>
  );
};

export { SortableGroupCard };
