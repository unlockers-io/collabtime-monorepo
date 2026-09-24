"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Hand, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmRemoveDialog } from "@/components/confirm-remove-dialog";
import { EditMemberDialog } from "@/components/edit-member-dialog";
import { teamQueryKeys } from "@/hooks/use-team-query";
import { removeMember } from "@/lib/actions/member-actions";
import { formatExpiresIn } from "@/lib/invitation-expiry";
import { queryKeys } from "@/lib/query-keys";
import {
  formatDuration,
  formatMinuteRange,
  formatTimezoneLabel,
  getMinutesUntilAvailable,
  getMinutesUntilDayEnds,
  isCurrentlyWorking,
} from "@/lib/timezones";
import { useHalfMinuteTick } from "@/lib/use-tick";
import type { PendingTeamInvitation, TeamGroup, TeamMember } from "@/types";

export type MemberCardProps = {
  canEdit: boolean;
  currentUserId?: string;
  /** Rendered before the avatar; the only element that starts a drag. */
  dragHandle?: ReactNode;
  groups: Array<TeamGroup>;
  hasClaimedProfile: boolean;
  member: TeamMember;
  pendingInvite?: PendingTeamInvitation;
  teamId: string;
};

const getStatus = (member: TeamMember) => {
  const { timezone, workingHoursEnd, workingHoursStart } = member;
  if (isCurrentlyWorking(timezone, workingHoursStart, workingHoursEnd)) {
    return {
      isWorking: true,
      label: `Working · ${formatDuration(getMinutesUntilDayEnds(timezone, workingHoursEnd))} left`,
    };
  }
  return {
    isWorking: false,
    label: `Off · starts in ${formatDuration(getMinutesUntilAvailable(timezone, workingHoursStart, workingHoursEnd))}`,
  };
};

type MemberActionsProps = {
  memberName: string;
  onEdit: () => void;
  onRemove: () => void;
};

const MemberActions = ({ memberName, onEdit, onRemove }: MemberActionsProps) => (
  <div className="flex shrink-0 items-center gap-0.5">
    <Button
      aria-label={`Edit ${memberName}`}
      className="max-sm:hidden"
      onClick={onEdit}
      size="icon-sm"
      variant="ghost"
    >
      <Pencil className="size-4" />
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button aria-label={`More actions for ${memberName}`} size="icon-sm" variant="ghost" />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRemove} variant="destructive">
          <Trash2 />
          Remove from workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

const MemberCard = ({
  canEdit,
  currentUserId,
  dragHandle,
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
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);

  const hasCurrentUser = currentUserId !== undefined && currentUserId !== "";
  const hasAccount = member.userId !== undefined && member.userId !== "";
  const isOwnProfile = hasCurrentUser && member.userId === currentUserId;
  const canClaim = hasCurrentUser && !hasAccount && !hasClaimedProfile;
  const hasLiveInvite =
    !hasAccount &&
    pendingInvite !== undefined &&
    formatExpiresIn(pendingInvite.expiresAt) !== "Expired";
  const groupName =
    member.groupId === undefined || member.groupId === ""
      ? undefined
      : groups.find((group) => group.id === member.groupId)?.name;

  useHalfMinuteTick();
  const status = getStatus(member);

  const handleRemove = () => {
    if (!canEdit) {
      return;
    }
    startTransition(async () => {
      const result = await removeMember(teamId, member.id);
      if (result.success) {
        setIsRemoveOpen(false);
        toast.success(`${member.name} removed`);
        void queryClient.invalidateQueries({ queryKey: teamQueryKeys.team(teamId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.teamInvitations(teamId) });
      } else {
        toast.error(result.error);
      }
    });
  };

  const removeConsequence = hasAccount
    ? "They leave the timeline and lose access to this workspace."
    : "They leave the timeline and any pending invitation is cancelled.";

  return (
    <>
      <div className="flex items-start gap-2 py-2.5 text-sm sm:items-center sm:gap-3">
        {dragHandle}
        <div className="relative shrink-0">
          <div className="flex size-8 items-center justify-center border border-border bg-secondary text-xs font-semibold text-secondary-foreground">
            {member.name.charAt(0).toUpperCase()}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-medium text-foreground">{member.name}</span>
              {isOwnProfile && <Badge variant="secondary">You</Badge>}
              {hasLiveInvite && (
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
                      <Badge variant="outline">Invited</Badge>
                    </TooltipTrigger>
                    <TooltipContent>{pendingInvite.email}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {[member.title, formatTimezoneLabel(member.timezone), groupName]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs sm:flex-col sm:items-end">
            <span className="font-mono text-foreground tabular-nums">
              {formatMinuteRange(member.workingHoursStart * 60, member.workingHoursEnd * 60)}
              <span className="font-sans text-muted-foreground"> local</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0",
                  status.isWorking ? "bg-foreground" : "border border-muted-foreground",
                )}
              />
              <span className="font-mono tabular-nums">{status.label}</span>
            </span>
          </div>
        </div>

        {canEdit && (
          <MemberActions
            memberName={member.name}
            onEdit={() => {
              setIsEditDialogOpen(true);
            }}
            onRemove={() => {
              setIsRemoveOpen(true);
            }}
          />
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

      {canEdit && (
        <>
          <EditMemberDialog
            groups={groups}
            member={member}
            onOpenChange={setIsEditDialogOpen}
            open={isEditDialogOpen}
            pendingInvite={pendingInvite}
            teamId={teamId}
          />
          <ConfirmRemoveDialog
            confirmLabel="Remove member"
            description={`${removeConsequence} This can't be undone.`}
            isPending={isPending}
            onConfirm={handleRemove}
            onOpenChange={setIsRemoveOpen}
            open={isRemoveOpen}
            title={`Remove ${member.name}?`}
          />
        </>
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
