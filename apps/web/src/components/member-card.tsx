"use client";

import {
  Button,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui";
import { Badge } from "@repo/ui";
import { Hand, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { EditMemberDialog } from "@/components/edit-member-dialog";
import { removeMember } from "@/lib/actions";
import {
  formatTimezoneLabel,
  isCurrentlyWorking,
  getMinutesUntilAvailable,
  formatTimeUntilAvailable,
} from "@/lib/timezones";
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
  member,
  teamId,
  groups,
  canEdit,
  currentUserId,
  hasClaimedProfile,
  onMemberRemoved,
  onMemberUpdated,
}: MemberCardProps) => {
  const [isPending, startTransition] = useTransition();
  const [isAvailable, setIsAvailable] = useState(false);
  const [minutesUntilAvailable, setMinutesUntilAvailable] = useState(0);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);

  const isOwnProfile = Boolean(currentUserId && member.userId === currentUserId);
  const canClaim = Boolean(currentUserId && !member.userId && !hasClaimedProfile);

  useEffect(() => {
    const checkAvailability = () => {
      const available = isCurrentlyWorking(
        member.timezone,
        member.workingHoursStart,
        member.workingHoursEnd,
      );
      setIsAvailable(available);

      if (!available) {
        setMinutesUntilAvailable(
          getMinutesUntilAvailable(
            member.timezone,
            member.workingHoursStart,
            member.workingHoursEnd,
          ),
        );
      } else {
        setMinutesUntilAvailable(0);
      }
    };

    checkAvailability();
    const interval = setInterval(checkAvailability, 60_000);
    return () => clearInterval(interval);
  }, [member.timezone, member.workingHoursStart, member.workingHoursEnd]);

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

  return (
    <>
      <div className="group min-h-45 gap-3 rounded-2xl p-4 shadow-sm hover:shadow-md flex h-full flex-col border border-border bg-card transition-all hover:border-input">
        {/* Top row: Avatar and Actions */}
        <div className="flex items-start justify-between">
          {/* Avatar with status */}
          <div className="relative">
            <div className="h-12 w-12 text-base font-semibold flex items-center justify-center rounded-full bg-muted text-muted-foreground dark:bg-primary dark:text-primary-foreground">
              {member.name.charAt(0).toUpperCase()}
            </div>
            {isAvailable && (
              <span className="-right-0.5 -bottom-0.5 h-4 w-4 bg-green-500 absolute flex items-center justify-center rounded-full border-2 border-background">
                <span className="animate-ping bg-green-400 absolute inline-flex h-full w-full rounded-full opacity-50" />
              </span>
            )}
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="gap-0.5 flex items-center opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsEditDialogOpen(true)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Edit ${member.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleRemove}
                disabled={isPending}
                className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 text-muted-foreground"
                aria-label={`Remove ${member.name}`}
              >
                {isPending ? <Spinner /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          )}
          {canClaim && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsClaimDialogOpen(true)}
              className="text-xs"
              aria-label={`Claim ${member.name}'s profile`}
            >
              <Hand className="mr-1 h-3.5 w-3.5" />
              That&apos;s me
            </Button>
          )}
        </div>

        {/* Info - stacked vertically */}
        <div className="gap-1.5 flex flex-1 flex-col">
          <div className="gap-0.5 flex flex-col">
            <span className="gap-1.5 font-semibold flex items-center text-foreground">
              {member.name}
              {isOwnProfile && (
                <Badge variant="secondary" className="text-xs border-transparent">
                  You
                </Badge>
              )}
            </span>
            {member.title && <span className="text-sm text-muted-foreground">{member.title}</span>}
          </div>

          {/* Timezone and hours */}
          <div className="gap-1 text-xs mt-auto flex flex-col text-muted-foreground">
            <span className="truncate">{formatTimezoneLabel(member.timezone)}</span>
            <span>
              {formatHour(member.workingHoursStart)} – {formatHour(member.workingHoursEnd)}
            </span>
          </div>

          {/* Status badges */}
          <div className="gap-1.5 flex flex-wrap">
            {isAvailable ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-transparent">
                <span className="h-1.5 w-1.5 bg-green-500 rounded-full" />
                Available
              </Badge>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 cursor-help border-transparent">
                      <span className="h-1.5 w-1.5 bg-amber-500 rounded-full" />
                      Not Available
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Available {formatTimeUntilAvailable(minutesUntilAvailable)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {member.groupId && groups.find((g) => g.id === member.groupId) && (
              <Badge variant="secondary" className="border-transparent">
                {groups.find((g) => g.id === member.groupId)?.name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {canEdit && (
        <EditMemberDialog
          member={member}
          teamId={teamId}
          groups={groups}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onMemberUpdated={onMemberUpdated}
        />
      )}
      {canClaim && (
        <EditMemberDialog
          member={member}
          teamId={teamId}
          groups={groups}
          mode="claim"
          open={isClaimDialogOpen}
          onOpenChange={setIsClaimDialogOpen}
          onMemberUpdated={(updated) => onMemberUpdated({ ...updated, userId: currentUserId })}
        />
      )}
    </>
  );
};

export { MemberCard };
