"use client";

import { useSortable } from "@dnd-kit/sortable";
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

const SortableMemberCard = (props: SortableMemberCardProps) => {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: props.member.id,
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
      <MemberCard {...props} />
    </div>
  );
};

export { SortableMemberCard };
