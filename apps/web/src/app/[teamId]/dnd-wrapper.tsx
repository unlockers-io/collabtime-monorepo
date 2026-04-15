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
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState } from "react";

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
  members,
  groups,
  teamId,
  hasClaimedProfile,
  onDragEnd,
  onDragTypeChange,
}: DndWrapperProps) => {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<"group" | "member" | null>(null);

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
    setActiveDragId(null);
    setActiveDragType(null);
    onDragTypeChange?.(null);
    onDragEnd(event, currentDragType);
  };

  const activeMember =
    activeDragId && activeDragType === "member" ? members.find((m) => m.id === activeDragId) : null;

  const activeGroup =
    activeDragId && activeDragType === "group" ? groups.find((g) => g.id === activeDragId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay>
        {activeMember && (
          <MemberCard
            member={activeMember}
            teamId={teamId}
            groups={groups}
            canEdit={false}
            hasClaimedProfile={hasClaimedProfile}
            onMemberRemoved={() => {}}
            onMemberUpdated={() => {}}
          />
        )}
        {activeGroup && (
          <GroupCard
            group={activeGroup}
            teamId={teamId}
            memberCount={members.filter((m) => m.groupId === activeGroup.id).length}
            canEdit={false}
            onGroupUpdated={() => {}}
            onGroupRemoved={() => {}}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
};

export { DndWrapper };
