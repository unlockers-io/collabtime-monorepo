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
  orderedMembers: Array<TeamMember>;
  teamId: string;
};

const MembersGrid = ({
  currentUserId,
  groups,
  hasClaimedProfile,
  isAdmin,
  orderedMembers,
  teamId,
}: MembersGridProps) => {
  if (orderedMembers.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-muted/50 px-6 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
          <Users className="size-6 text-muted-foreground" />
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
    <ScrollArea className="-m-px max-h-150">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4 p-px pr-4">
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
              teamId={teamId}
            />
          ))
        )}
      </div>
    </ScrollArea>
  );
};

export { MembersGrid };
