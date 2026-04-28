"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Spinner } from "@repo/ui/components/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { Hand, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EditMemberDialog } from "@/components/edit-member-dialog";
import { removeMember } from "@/lib/actions/member-actions";
import {
  formatTimezoneLabel,
  isCurrentlyWorking,
  getMinutesUntilAvailable,
  formatTimeUntilAvailable,
} from "@/lib/timezones";
import { useHalfMinuteTick } from "@/lib/use-tick";
import { formatHour } from "@/lib/utils";
import type { TeamGroup, TeamMember } from "@/types";

type MemberCardProps = {
  canEdit: boolean;
  currentUserId?: string;
  groups: Array<TeamGroup>;
  hasClaimedProfile: boolean;
  member: TeamMember;
  onMemberRemoved: (memberId: string) => void;
  onMemberUpdated: (member: TeamMember) => void;
  teamId: string;
};

const MemberCard = ({
  canEdit,
  currentUserId,
  groups,
  hasClaimedProfile,
  member,
  onMemberRemoved,
  onMemberUpdated,
  teamId,
}: MemberCardProps) => {
  const [isPending, startTransition] = useTransition();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);

  const isOwnProfile = Boolean(currentUserId && member.userId === currentUserId);
  const canClaim = Boolean(currentUserId && !member.userId && !hasClaimedProfile);

  // Re-render every 30s; derive availability during render instead of mirroring
  // it into state via an effect (https://react.dev/learn/you-might-not-need-an-effect).
  useHalfMinuteTick();
  const isAvailable = isCurrentlyWorking(
    member.timezone,
    member.workingHoursStart,
    member.workingHoursEnd,
  );
  const minutesUntilAvailable = isAvailable
    ? 0
    : getMinutesUntilAvailable(member.timezone, member.workingHoursStart, member.workingHoursEnd);

  const handleRemove = () => {
    if (!canEdit) {
      return;
    }
    startTransition(async () => {
      const result = await removeMember(teamId, member.id);
      if (result.success) {
        onMemberRemoved(member.id);
      } else {
        toast.error(result.error);
      }
    });
  };

  const memberGroupName = member.groupId ? groups.find((g) => g.id === member.groupId)?.name : null;

  return (
    <>
      <Card className="group h-full gap-3 p-4 transition-shadow hover:shadow-md">
        {/* Top row: Avatar and Actions */}
        <div className="flex items-start justify-between">
          {/* Avatar with status */}
          <div className="relative">
            <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-base font-semibold text-secondary-foreground">
              {member.name.charAt(0).toUpperCase()}
            </div>
            {isAvailable && (
              <span className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-card bg-success" />
            )}
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                aria-label={`Edit ${member.name}`}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setIsEditDialogOpen(true)}
                size="icon-sm"
                variant="ghost"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                aria-label={`Remove ${member.name}`}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                disabled={isPending}
                onClick={handleRemove}
                size="icon-sm"
                variant="ghost"
              >
                {isPending ? <Spinner /> : <Trash2 className="size-4" />}
              </Button>
            </div>
          )}
          {canClaim && (
            <Button
              aria-label={`Claim ${member.name}'s profile`}
              className="gap-1.5 text-xs"
              onClick={() => setIsClaimDialogOpen(true)}
              size="sm"
              variant="outline"
            >
              <Hand className="size-3.5" />
              That&apos;s me
            </Button>
          )}
        </div>

        {/* Info - stacked vertically */}
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              {member.name}
              {isOwnProfile && (
                <Badge className="border-transparent text-xs" variant="secondary">
                  You
                </Badge>
              )}
            </span>
            {member.title && <span className="text-sm text-muted-foreground">{member.title}</span>}
          </div>

          {/* Timezone and hours */}
          <div className="mt-auto flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="truncate">{formatTimezoneLabel(member.timezone)}</span>
            <span className="tabular-nums">
              {formatHour(member.workingHoursStart)} – {formatHour(member.workingHoursEnd)}
            </span>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-1.5">
            {isAvailable ? (
              <Badge variant="success">Available</Badge>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <Badge className="cursor-help" variant="warning">
                      Not Available
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Available {formatTimeUntilAvailable(minutesUntilAvailable)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {memberGroupName && <Badge variant="secondary">{memberGroupName}</Badge>}
          </div>
        </div>
      </Card>

      {canEdit && (
        <EditMemberDialog
          groups={groups}
          member={member}
          onMemberUpdated={onMemberUpdated}
          onOpenChange={setIsEditDialogOpen}
          open={isEditDialogOpen}
          teamId={teamId}
        />
      )}
      {canClaim && (
        <EditMemberDialog
          groups={groups}
          member={member}
          mode="claim"
          onMemberUpdated={(updated) => onMemberUpdated({ ...updated, userId: currentUserId })}
          onOpenChange={setIsClaimDialogOpen}
          open={isClaimDialogOpen}
          teamId={teamId}
        />
      )}
    </>
  );
};

export { MemberCard };
