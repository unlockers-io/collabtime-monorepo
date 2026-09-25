"use client";
import { JoinRequestsPanel } from "@/components/join-requests-panel";
import { PendingInvitationsPanel } from "@/components/pending-invitations-panel";
import type { TeamMember } from "@/types";

import { AddOwnProfileButton } from "./add-own-profile-button";
import { JoinPrompt } from "./join-prompt";
import type { JoinPromptProps } from "./join-prompt";

type Props = JoinPromptProps & {
  hasClaimedProfile: boolean;
  isAdmin: boolean;
  isMember: boolean;
  members: Array<TeamMember>;
};
export const MembershipActions = ({
  hasClaimedProfile,
  isAdmin,
  isMember,
  members,
  ...props
}: Props) => {
  if (!isAdmin && !isMember) {
    return <JoinPrompt {...props} />;
  }
  return (
    <div className="flex flex-col gap-4">
      {hasClaimedProfile ? (
        !isAdmin && <p className="text-sm text-muted-foreground">You are a member of this team.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Your profile isn&apos;t on this team yet</p>
          <AddOwnProfileButton teamId={props.teamId} />
        </div>
      )}
      {isAdmin && (
        <>
          <JoinRequestsPanel teamId={props.teamId} />
          <PendingInvitationsPanel members={members} teamId={props.teamId} />
        </>
      )}
    </div>
  );
};
