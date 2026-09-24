"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { MemberCard } from "@/components/member-card";
import { SortableMemberCard } from "@/components/sortable-member-card";
import { usePendingTeamInvitations } from "@/hooks/use-pending-team-invitations";
import { formatExpiresIn } from "@/lib/invitation-expiry";
import { useHalfMinuteTick } from "@/lib/use-tick";
import type { PendingTeamInvitation, TeamGroup, TeamMember } from "@/types";

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
  const { data: invitations = [] } = usePendingTeamInvitations(teamId, isAdmin);
  useHalfMinuteTick();
  const inviteByMember = new Map<string, PendingTeamInvitation>();
  for (const invitation of invitations) {
    const existing = inviteByMember.get(invitation.memberId);
    if (
      !existing ||
      (formatExpiresIn(existing.expiresAt) === "Expired" &&
        formatExpiresIn(invitation.expiresAt) !== "Expired")
    ) {
      inviteByMember.set(invitation.memberId, invitation);
    }
  }

  if (orderedMembers.length === 0) {
    return (
      <div className="flex flex-col gap-1 border-y border-border py-8">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-foreground">Build your team</h3>
          <p className="max-w-md text-sm text-pretty text-muted-foreground">
            Add team members to see their working hours and find the best times to collaborate
            across timezones.
          </p>
        </div>
      </div>
    );
  }

  const memberIds = orderedMembers.map((m) => m.id);

  return (
    <div className="flex flex-col divide-y divide-border border-y border-border">
      {isAdmin ? (
        <SortableContext items={memberIds} strategy={verticalListSortingStrategy}>
          {orderedMembers.map((member) => (
            <SortableMemberCard
              canEdit={isAdmin}
              currentUserId={currentUserId}
              groups={groups}
              hasClaimedProfile={hasClaimedProfile}
              key={member.id}
              member={member}
              pendingInvite={inviteByMember.get(member.id)}
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
  );
};

export { MembersGrid };
