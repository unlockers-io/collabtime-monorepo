"use client";

import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Users } from "lucide-react";

import { MemberCard } from "@/components/member-card";
import { SortableMemberCard } from "@/components/sortable-member-card";
import type { TeamGroup, TeamMember } from "@/types";

type MembersGridProps = {
  currentUserId?: string;
  groups: Array<TeamGroup>;
  hasClaimedProfile: boolean;
  isAdmin: boolean;
  onMemberRemoved: (memberId: string) => void;
  onMemberUpdated: (member: TeamMember) => void;
  orderedMembers: Array<TeamMember>;
  teamId: string;
};

const MembersGrid = ({
  currentUserId,
  groups,
  hasClaimedProfile,
  isAdmin,
  onMemberRemoved,
  onMemberUpdated,
  orderedMembers,
  teamId,
}: MembersGridProps) => {
  if (orderedMembers.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-muted/50 px-6 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
          <Users className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-foreground">Build your team</h3>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Add team members to see their working hours and find the best times to collaborate
            across timezones.
          </p>
        </div>
      </div>
    );
  }

  const memberIds = orderedMembers.map((m) => m.id);

  return (
    <ScrollArea className="max-h-150">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 pr-4">
        {isAdmin ? (
          <SortableContext items={memberIds} strategy={rectSortingStrategy}>
            {orderedMembers.map((member) => (
              <SortableMemberCard
                canEdit={isAdmin}
                currentUserId={currentUserId}
                groups={groups}
                hasClaimedProfile={hasClaimedProfile}
                key={member.id}
                member={member}
                onMemberRemoved={onMemberRemoved}
                onMemberUpdated={onMemberUpdated}
                teamId={teamId}
              />
            ))}
          </SortableContext>
        ) : (
          orderedMembers.map((member) => (
            <MemberCard
              canEdit={false}
              currentUserId={currentUserId}
              groups={groups}
              hasClaimedProfile={hasClaimedProfile}
              key={member.id}
              member={member}
              onMemberRemoved={onMemberRemoved}
              onMemberUpdated={onMemberUpdated}
              teamId={teamId}
            />
          ))
        )}
      </div>
    </ScrollArea>
  );
};

export { MembersGrid };
