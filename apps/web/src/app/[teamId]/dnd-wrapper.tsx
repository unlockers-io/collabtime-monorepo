"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  defaultAnnouncements,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState } from "react";

import { GroupCard } from "@/components/group-card";
import { MemberCard } from "@/components/member-card";
import type { TeamGroup, TeamMember } from "@/types";

/**
 * Holds the resolved entity, not an id plus a separate kind. The pair let
 * "id set, kind unknown" be expressed, which every read then had to guard
 * against, and it forced a second lookup on each render of a drag.
 */
type ActiveDrag = { group: TeamGroup; kind: "group" } | { kind: "member"; member: TeamMember };

type DndWrapperProps = {
  children: React.ReactNode;
  groups: Array<TeamGroup>;
  hasClaimedProfile: boolean;
  members: Array<TeamMember>;
  onDragEnd: (event: DragEndEvent, dragType: "group" | "member" | null) => void;
  onDragTypeChange?: (dragType: "group" | "member" | null) => void;
  teamId: string;
};

const DndWrapper = ({
  children,
  groups,
  hasClaimedProfile,
  members,
  onDragEnd,
  onDragTypeChange,
  teamId,
}: DndWrapperProps) => {
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const droppedOnGroupRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);

    const member = members.find((m) => m.id === id);
    if (member) {
      setActiveDrag({ kind: "member", member });
      onDragTypeChange?.("member");
      return;
    }

    const group = groups.find((g) => g.id === id);
    if (group) {
      setActiveDrag({ group, kind: "group" });
      onDragTypeChange?.("group");
    }
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
        announcements: defaultAnnouncements,
        screenReaderInstructions: {
          draggable:
            "To pick up a draggable item, press Space or Enter. To move the item, use the arrow keys. To drop the item, press Space or Enter again. To cancel, press Escape.",
        },
      }}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      {children}
      <DragOverlay dropAnimation={dropAnimation}>
        {activeDrag?.kind === "member" && (
          <MemberCard
            canEdit={false}
            groups={groups}
            hasClaimedProfile={hasClaimedProfile}
            member={activeDrag.member}
            teamId={teamId}
          />
        )}
        {activeDrag?.kind === "group" && (
          <GroupCard
            canEdit={false}
            group={activeDrag.group}
            memberCount={members.filter((m) => m.groupId === activeDrag.group.id).length}
            teamId={teamId}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
};

export { DndWrapper };
