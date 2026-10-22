"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState } from "react";

import { GroupDragPreview, type GroupDrag } from "@/components/sortable-group-card";
import { MemberDragPreview, type MemberDrag } from "@/components/sortable-member-card";
import type { TeamGroup, TeamMember } from "@/types";

/** The dragged card's own props, so the overlay renders exactly what the row shows. */
type ActiveDrag = GroupDrag | MemberDrag;

const isActiveDrag = (value: unknown): value is ActiveDrag =>
  typeof value === "object" &&
  value !== null &&
  "props" in value &&
  "kind" in value &&
  (value.kind === "group" || value.kind === "member");

type DndWrapperProps = {
  children: React.ReactNode;
  groups: Array<TeamGroup>;
  members: Array<TeamMember>;
  onDragEnd: (event: DragEndEvent, dragType: "group" | "member" | null) => void;
  onDragTypeChange?: (dragType: "group" | "member" | null) => void;
};

const DndWrapper = ({
  children,
  groups,
  members,
  onDragEnd,
  onDragTypeChange,
}: DndWrapperProps) => {
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const droppedOnGroupRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const drag: unknown = event.active.data.current?.drag;

    if (!isActiveDrag(drag)) {
      return;
    }

    setActiveDrag(drag);
    onDragTypeChange?.(drag.kind);
  };

  const nameOf = (id: UniqueIdentifier): string => {
    const key = String(id);
    const member = members.find((m) => m.id === key);

    if (member) {
      return member.name;
    }

    const group = groups.find((g) => g.id === key);

    return group ? `the ${group.name} group` : "this item";
  };

  const describeTarget = (activeId: UniqueIdentifier, overId: UniqueIdentifier): string => {
    const isMemberOverGroup =
      members.some((m) => m.id === String(activeId)) && groups.some((g) => g.id === String(overId));

    return isMemberOverGroup ? `into ${nameOf(overId)}` : `to the place of ${nameOf(overId)}`;
  };

  const announcements: Announcements = {
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} was dropped ${describeTarget(active.id, over.id)}.`
        : `${nameOf(active.id)} was dropped.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over ${nameOf(over.id)}.` : undefined,
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
  };

  const handleDragCancel = () => {
    droppedOnGroupRef.current = false;
    setActiveDrag(null);
    onDragTypeChange?.(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const currentDragType = activeDrag?.kind ?? null;
    droppedOnGroupRef.current =
      currentDragType === "member" &&
      event.over !== null &&
      groups.some((g) => g.id === event.over?.id);
    setActiveDrag(null);
    onDragTypeChange?.(null);
    onDragEnd(event, currentDragType);
  };

  const hideActiveNode = defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0" } },
  });

  const dropAnimation: DropAnimation = {
    duration: 200,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    keyframes: ({ transform }) => {
      if (droppedOnGroupRef.current) {
        const initial = CSS.Transform.toString(transform.initial);

        return [
          { opacity: 1, transform: initial },
          { opacity: 0, transform: `${initial} scale(0.85)` },
        ];
      }

      return [
        { transform: CSS.Transform.toString(transform.initial) },
        { transform: CSS.Transform.toString(transform.final) },
      ];
    },
    sideEffects: (parameters) => {
      if (droppedOnGroupRef.current) {
        return;
      }

      return hideActiveNode(parameters);
    },
  };

  return (
    <DndContext
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Press Space or Enter to pick up. Use the arrow keys to move, Space or Enter to drop, and Escape to cancel.",
        },
      }}
      collisionDetection={closestCenter}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      {children}
      <DragOverlay className="bg-background" dropAnimation={dropAnimation}>
        {activeDrag?.kind === "member" && <MemberDragPreview {...activeDrag.props} />}
        {activeDrag?.kind === "group" && <GroupDragPreview {...activeDrag.props} />}
      </DragOverlay>
    </DndContext>
  );
};

export { DndWrapper };
