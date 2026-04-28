"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<"group" | "member" | null>(null);
  // Read synchronously by `dropAnimation.keyframes` after `onDragEnd` fires,
  // so it must be a ref — state updates would land too late for the animation.
  const droppedOnGroupRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    if (members.some((m) => m.id === id)) {
      setActiveDragType("member");
      setActiveDragId(id);
      onDragTypeChange?.("member");
    } else if (groups.some((g) => g.id === id)) {
      setActiveDragType("group");
      setActiveDragId(id);
      onDragTypeChange?.("group");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const currentDragType = activeDragType;
    droppedOnGroupRef.current =
      currentDragType === "member" &&
      event.over !== null &&
      groups.some((g) => g.id === event.over?.id);
    setActiveDragId(null);
    setActiveDragType(null);
    onDragTypeChange?.(null);
    onDragEnd(event, currentDragType);
  };

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
  };

  const activeMember =
    activeDragId && activeDragType === "member" ? members.find((m) => m.id === activeDragId) : null;

  const activeGroup =
    activeDragId && activeDragType === "group" ? groups.find((g) => g.id === activeDragId) : null;

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      {children}
      <DragOverlay dropAnimation={dropAnimation}>
        {activeMember && (
          <MemberCard
            canEdit={false}
            groups={groups}
            hasClaimedProfile={hasClaimedProfile}
            member={activeMember}
            onMemberRemoved={() => {}}
            onMemberUpdated={() => {}}
            teamId={teamId}
          />
        )}
        {activeGroup && (
          <GroupCard
            canEdit={false}
            group={activeGroup}
            memberCount={members.filter((m) => m.groupId === activeGroup.id).length}
            onGroupRemoved={() => {}}
            onGroupUpdated={() => {}}
            teamId={teamId}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
};

export { DndWrapper };
