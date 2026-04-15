"use client";

import {
  defaultAnimateLayoutChanges,
  useSortable,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { MemberCard } from "@/components/member-card";
import type { TeamGroup, TeamMember } from "@/types";

type SortableMemberCardProps = {
  canEdit: boolean;
  currentUserId?: string;
  groups: Array<TeamGroup>;
  hasClaimedProfile: boolean;
  member: TeamMember;
  onMemberRemoved: (memberId: string) => void;
  onMemberUpdated: (member: TeamMember) => void;
  teamId: string;
};

const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { isSorting, wasDragging } = args;
  if (isSorting || wasDragging) {
    return false;
  }
  return defaultAnimateLayoutChanges(args);
};

const SortableMemberCard = (props: SortableMemberCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.member.id,
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
      <MemberCard {...props} />
    </div>
  );
};

export { SortableMemberCard };
