"use client";
import { Button } from "@repo/ui/components/button";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Mail, ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState } from "react";

import { usePendingTeamInvitations } from "@/hooks/use-pending-team-invitations";
import { formatExpiresIn } from "@/lib/invitation-expiry";
import { useHalfMinuteTick } from "@/lib/use-tick";
import type { TeamMember, PendingTeamInvitation } from "@/types";

import { InvitationControls } from "./invitation-controls";

type Props = { members: Array<TeamMember>; teamId: string };
export const PendingInvitationsPanelView = ({
  invitations,
  members,
  renderControls,
}: {
  invitations: Array<PendingTeamInvitation>;
  members: Array<TeamMember>;
  renderControls: (invitation: PendingTeamInvitation) => React.ReactNode;
}) => {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  useHalfMinuteTick();
  if (invitations.length === 0) {
    return null;
  }
  return (
    <div className="border-b border-border">
      <button
        aria-controls={id}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 rounded-sm py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => {
          setExpanded(!expanded);
        }}
        type="button"
      >
        <span className="flex items-center gap-2.5 text-sm font-medium text-foreground">
          <Mail aria-hidden className="size-4 text-muted-foreground" />
          Pending invitations
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {invitations.length}
          </span>
        </span>
        {expanded ? (
          <ChevronUp aria-hidden className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <ScrollArea className="max-h-80" id={id}>
          <ul className="divide-y divide-border border-t border-border">
            {invitations.map((invitation) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                key={invitation.id}
              >
                <div className="min-w-0 flex-1 basis-48">
                  <p className="text-sm font-medium break-all">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {members.find((member) => member.id === invitation.memberId)?.name ??
                      "Removed member"}
                    {invitation.expiresAt !== null && ` · ${formatExpiresIn(invitation.expiresAt)}`}
                  </p>
                </div>
                {renderControls(invitation)}
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
};
export const PendingInvitationsPanel = ({ members, teamId }: Props) => {
  const { data = [], error, isLoading, refetch } = usePendingTeamInvitations(teamId);
  if (isLoading) {
    return <output className="text-sm text-muted-foreground">Loading invitations…</output>;
  }
  if (error) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-sm text-destructive" role="alert">
          Could not load invitations.
        </p>
        <Button
          onClick={() => {
            void refetch();
          }}
          size="sm"
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }
  return (
    <PendingInvitationsPanelView
      invitations={data}
      members={members}
      renderControls={(invitation) => (
        <InvitationControls invitation={invitation} teamId={teamId} />
      )}
    />
  );
};
