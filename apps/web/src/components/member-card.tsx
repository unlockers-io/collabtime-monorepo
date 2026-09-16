"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { StatusBadge as StatusPill } from "@repo/ui/compositions/status-badge";
import { useQueryClient } from "@tanstack/react-query";
import { Hand, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EditMemberDialog } from "@/components/edit-member-dialog";
import { teamQueryKeys } from "@/hooks/use-team-query";
import { removeMember } from "@/lib/actions/member-actions";
import { formatExpiresIn } from "@/lib/invitation-expiry";
import { queryKeys } from "@/lib/query-keys";
import {
  formatTimezoneLabel,
  isCurrentlyWorking,
  getMinutesUntilAvailable,
  formatTimeUntilAvailable,
} from "@/lib/timezones";
import { useHalfMinuteTick } from "@/lib/use-tick";
import { formatHour } from "@/lib/utils";
import type { PendingTeamInvitation, TeamGroup, TeamMember } from "@/types";

export type MemberCardProps = {
  canEdit: boolean;
  currentUserId?: string;
  groups: Array<TeamGroup>;
  hasClaimedProfile: boolean;
  member: TeamMember;
  pendingInvite?: PendingTeamInvitation;
  teamId: string;
};

const MemberDetails = ({
  groups,
  isAvailable,
  isOwnProfile,
  member,
  minutesUntilAvailable,
  pendingInvite,
}: Pick<MemberCardProps, "groups" | "member" | "pendingInvite"> & {
  isAvailable: boolean;
  isOwnProfile: boolean;
  minutesUntilAvailable: number;
}) => {
  const memberGroupName =
    member.groupId !== undefined && member.groupId !== ""
      ? groups.find((g) => g.id === member.groupId)?.name
      : undefined;

  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          {member.name}
          {isOwnProfile && <Badge variant="secondary">You</Badge>}
        </span>
        {member.title && <span className="text-sm text-muted-foreground">{member.title}</span>}
      </div>

      <div className="mt-auto flex flex-col gap-1 text-xs text-muted-foreground">
        <span className="truncate">{formatTimezoneLabel(member.timezone)}</span>
        <span className="font-mono tabular-nums">
          {formatHour(member.workingHoursStart)} – {formatHour(member.workingHoursEnd)}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(member.userId === undefined || member.userId === "") &&
          pendingInvite &&
          formatExpiresIn(pendingInvite.expiresAt) !== "Expired" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      aria-label={`Invitation sent to ${pendingInvite.email}`}
                      className="cursor-help"
                      type="button"
                    />
                  }
                >
                  <StatusPill tone="info">Invited</StatusPill>
                </TooltipTrigger>
                <TooltipContent>{pendingInvite.email}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        {isAvailable ? (
          <StatusPill tone="success">Available</StatusPill>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={<span />}>
                <StatusPill className="cursor-help" tone="warning">
                  Not Available
                </StatusPill>
              </TooltipTrigger>
              <TooltipContent>
                <p>Available {formatTimeUntilAvailable(minutesUntilAvailable)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {memberGroupName !== undefined && memberGroupName !== "" && (
          <Badge variant="secondary">{memberGroupName}</Badge>
        )}
      </div>
    </div>
  );
};

const MemberCard = ({
  canEdit,
  currentUserId,
  groups,
  hasClaimedProfile,
  member,
  pendingInvite,
  teamId,
}: MemberCardProps) => {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);

  const hasCurrentUser = currentUserId !== undefined && currentUserId !== "";
  const isOwnProfile = hasCurrentUser && member.userId === currentUserId;
  const canClaim =
    hasCurrentUser && (member.userId === undefined || member.userId === "") && !hasClaimedProfile;

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
        void queryClient.invalidateQueries({ queryKey: teamQueryKeys.team(teamId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.teamInvitations(teamId) });
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <>
      <div className="group relative isolate flex flex-col gap-3 py-4 text-sm before:absolute before:-inset-x-4 before:inset-y-0 before:-z-10 before:rounded-lg before:bg-transparent before:transition-colors focus-within:before:bg-muted/30 hover:before:bg-muted/30">
        <div className="flex items-start justify-between">
          <div className="relative">
            <div className="flex size-10 items-center justify-center border border-border bg-secondary text-sm font-semibold text-secondary-foreground">
              {member.name.charAt(0).toUpperCase()}
            </div>
            {isAvailable && (
              <span className="absolute -right-0.5 -bottom-0.5 size-3 border-2 border-background bg-success" />
            )}
          </div>

          {canEdit && (
            <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <Button
                aria-label={`Edit ${member.name}`}
                onClick={() => {
                  setIsEditDialogOpen(true);
                }}
                size="icon-sm"
                variant="ghost"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                aria-label={`Remove ${member.name}`}
                disabled={isPending}
                onClick={handleRemove}
                size="icon-sm"
                variant="destructive"
              >
                {isPending ? <Spinner /> : <Trash2 className="size-4" />}
              </Button>
            </div>
          )}
          {canClaim && (
            <Button
              aria-label={`Claim ${member.name}'s profile`}
              onClick={() => {
                setIsClaimDialogOpen(true);
              }}
              size="sm"
              variant="outline"
            >
              <Hand className="size-3.5" />
              That&apos;s me
            </Button>
          )}
        </div>

        <MemberDetails
          groups={groups}
          isAvailable={isAvailable}
          isOwnProfile={isOwnProfile}
          member={member}
          minutesUntilAvailable={minutesUntilAvailable}
          pendingInvite={pendingInvite}
        />
      </div>

      {canEdit && (
        <EditMemberDialog
          groups={groups}
          member={member}
          onOpenChange={setIsEditDialogOpen}
          open={isEditDialogOpen}
          pendingInvite={pendingInvite}
          teamId={teamId}
        />
      )}
      {canClaim && (
        <EditMemberDialog
          groups={groups}
          member={member}
          mode="claim"
          onOpenChange={setIsClaimDialogOpen}
          open={isClaimDialogOpen}
          teamId={teamId}
        />
      )}
    </>
  );
};

export { MemberCard };
