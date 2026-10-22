"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { MemberCard } from "@/components/member-card";
import type { MemberCardProps } from "@/components/member-card";

const DRAG_HANDLE_CLASS =
  "flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing";

type MemberDrag = { kind: "member"; props: MemberCardProps };

const SortableMemberCard = (props: MemberCardProps) => {
  const drag: MemberDrag = { kind: "member", props };
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ data: { drag }, id: props.member.id });

  const style = {
    "--sortable-member-card-opacity": isDragging ? 0.5 : 1,
    "--sortable-member-card-transform": CSS.Translate.toString(transform),
    "--sortable-member-card-transition": transition,
  };

  return (
    <div className="sortable-member-geometry" ref={setNodeRef} style={style}>
      <MemberCard
        {...props}
        dragHandle={
          <button
            className={DRAG_HANDLE_CLASS}
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Move ${props.member.name}`}
            aria-roledescription="draggable"
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </div>
  );
};

const MemberDragPreview = (props: MemberCardProps) => (
  <div inert>
    <MemberCard
      {...props}
      dragHandle={
        <span className={DRAG_HANDLE_CLASS}>
          <GripVertical className="size-4" />
        </span>
      }
    />
  </div>
);

export { MemberDragPreview, SortableMemberCard };
export type { MemberDrag };
