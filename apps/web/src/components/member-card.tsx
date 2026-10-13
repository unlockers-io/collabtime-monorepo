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
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { cn } from "@repo/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Hand, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmRemoveDialog } from "@/components/confirm-remove-dialog";
import { EditMemberDialog } from "@/components/edit-member-dialog";
import { useTeamWrite } from "@/hooks/use-team-write";
import { removeMember } from "@/lib/actions/member-actions";
import { formatExpiresIn } from "@/lib/invitation-expiry";
import { queryKeys } from "@/lib/query-keys";
import {
  formatDuration,
  formatMinuteRange,
  formatTimezoneCity,
  formatTimezoneLabel,
  getMemberStatus,
} from "@/lib/timezones";
import type { MemberStatus } from "@/lib/timezones";
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

const formatStatus = (status: MemberStatus): string =>
  status.kind === "working"
    ? `Working · ${formatDuration(status.minutesLeft)} left`
    : `Off · starts in ${formatDuration(status.minutesUntilStart)}`;

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

const getGroupName = (member: TeamMember, groups: Array<TeamGroup>) =>
  groups.find((group) => group.id === member.groupId)?.name;

const hasAccount = (member: TeamMember) => member.userId !== undefined && member.userId !== "";

/** The invitation worth showing: only for an unclaimed profile, and only while it can be accepted. */
const getLiveInvite = (member: TeamMember, pendingInvite?: PendingTeamInvitation) =>
  !hasAccount(member) &&
  pendingInvite !== undefined &&
  formatExpiresIn(pendingInvite.expiresAt) !== "Expired"
    ? pendingInvite
    : undefined;

type MemberIdentityProps = {
  groupName?: string;
  isOwnProfile: boolean;
  liveInvite?: PendingTeamInvitation;
  member: TeamMember;
  now: Date | null;
};

const MemberIdentity = ({
  groupName,
  isOwnProfile,
  liveInvite,
  member,
  now,
}: MemberIdentityProps) => (
  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
    <p className="flex min-w-0 items-center gap-1.5">
      <span className="truncate font-medium text-foreground">{member.name}</span>
      {isOwnProfile && <Badge variant="secondary">You</Badge>}
      {liveInvite !== undefined && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  aria-label={`Invitation sent to ${liveInvite.email}`}
                  className="cursor-help"
                  type="button"
                />
              }
            >
              <Badge variant="outline">Invited</Badge>
            </TooltipTrigger>
            <TooltipContent>{liveInvite.email}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </p>
    <p className="truncate text-xs text-muted-foreground">
      {[
        member.title,
        now === null
          ? formatTimezoneCity(member.timezone)
          : formatTimezoneLabel(member.timezone, now),
        groupName,
      ]
        .filter(Boolean)
        .join(" · ")}
    </p>
  </div>
);

const MemberSchedule = ({ member, now }: { member: TeamMember; now: Date | null }) => {
  const status = now === null ? null : getMemberStatus(member, now);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs sm:flex-col sm:items-end">
      <span className="font-mono text-foreground tabular-nums">
        {formatMinuteRange(member.workingHoursStart * 60, member.workingHoursEnd * 60)}
        <span className="font-sans text-muted-foreground"> local</span>
      </span>
      {status !== null && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span
            aria-hidden
            className={cn(
              "size-1.5 shrink-0",
              status.kind === "working" ? "bg-foreground" : "border border-muted-foreground",
            )}
          />
          <span className="font-mono tabular-nums">{formatStatus(status)}</span>
        </span>
      )}
    </div>
  );
};

type MemberAdminControlsProps = Pick<
  MemberCardProps,
  "groups" | "member" | "pendingInvite" | "teamId"
>;

const MemberAdminControls = ({
  groups,
  member,
  pendingInvite,
  teamId,
}: MemberAdminControlsProps) => {
  const queryClient = useQueryClient();
  const writeTeam = useTeamWrite(teamId);
  const [isPending, startTransition] = useTransition();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);

  const handleRemove = () => {
    startTransition(async () => {
      const result = await writeTeam({
        optimistic: (team) => ({
          ...team,
          members: team.members.filter((m) => m.id !== member.id),
        }),
        submit: () => removeMember(teamId, member.id),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setIsRemoveOpen(false);
      toast.success(`${member.name} removed`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamInvitations(teamId) });
    });
  };

  const consequence = hasAccount(member)
    ? "They leave the timeline and lose access to this workspace."
    : "They leave the timeline and any pending invitation is cancelled.";

  return (
    <>
      <MemberActions
        memberName={member.name}
        onEdit={() => {
          setIsEditOpen(true);
        }}
        onRemove={() => {
          setIsRemoveOpen(true);
        }}
      />
      <EditMemberDialog
        groups={groups}
        member={member}
        onOpenChange={setIsEditOpen}
        open={isEditOpen}
        pendingInvite={pendingInvite}
        teamId={teamId}
      />
      <ConfirmRemoveDialog
        confirmLabel="Remove member"
        description={`${consequence} This can't be undone.`}
        isPending={isPending}
        onConfirm={handleRemove}
        onOpenChange={setIsRemoveOpen}
        open={isRemoveOpen}
        title={`Remove ${member.name}?`}
      />
    </>
  );
};

type ClaimProfileControlProps = Pick<MemberCardProps, "groups" | "member" | "teamId">;

const ClaimProfileControl = ({ groups, member, teamId }: ClaimProfileControlProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const ready = useClientReady();

  return (
    <>
      <Button
        aria-label={`Claim ${member.name}'s profile`}
        disabled={!ready}
        onClick={() => {
          setIsOpen(true);
        }}
        size="sm"
        variant="outline"
      >
        <Hand className="size-3.5" />
        That&apos;s me
      </Button>
      <EditMemberDialog
        groups={groups}
        member={member}
        mode="claim"
        onOpenChange={setIsOpen}
        open={isOpen}
        teamId={teamId}
      />
    </>
  );
};

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
  const tick = useHalfMinuteTick();
  const now = tick === 0 ? null : new Date(tick);
  const hasCurrentUser = currentUserId !== undefined && currentUserId !== "";
  const canClaim = hasCurrentUser && !hasAccount(member) && !hasClaimedProfile;

  return (
    <div className="flex items-start gap-2 py-2.5 text-sm sm:items-center sm:gap-3">
      {dragHandle}
      <div className="flex size-8 shrink-0 items-center justify-center border border-border bg-secondary text-xs font-semibold text-secondary-foreground">
        {member.name.charAt(0).toUpperCase()}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
        <MemberIdentity
          groupName={getGroupName(member, groups)}
          isOwnProfile={hasCurrentUser && member.userId === currentUserId}
          liveInvite={getLiveInvite(member, pendingInvite)}
          member={member}
          now={now}
        />
        <MemberSchedule member={member} now={now} />
      </div>

      {canEdit && (
        <MemberAdminControls
          groups={groups}
          member={member}
          pendingInvite={pendingInvite}
          teamId={teamId}
        />
      )}
      {canClaim && <ClaimProfileControl groups={groups} member={member} teamId={teamId} />}
    </div>
  );
};

export { MemberCard };
