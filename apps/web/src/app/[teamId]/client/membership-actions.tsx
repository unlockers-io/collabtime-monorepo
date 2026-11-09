"use client";

import { JoinRequestsPanel } from "@/components/join-requests-panel";
import { PendingInvitationsPanel } from "@/components/pending-invitations-panel";
import type { TeamMember } from "@/types";

import type { TeamPageViewer } from "../viewer";

import { AddOwnProfileButton } from "./add-own-profile-button";
import { JoinPrompt } from "./join-prompt";
import type { TeamMembership } from "./use-team-membership";

type Props = {
  members: Array<TeamMember>;
  membership: TeamMembership;
  returnTo: string;
  teamId: string;
  teamName: string;
  viewer: TeamPageViewer;
};

export const MembershipActions = ({
  members,
  membership,
  returnTo,
  teamId,
  teamName,
  viewer,
}: Props) => {
  const { hasClaimedProfile, isAdmin, isMember } = membership;

  if (!isAdmin && !isMember) {
    return (
      <JoinPrompt
        isRequestingJoin={membership.isRequestingJoin}
        onRequestJoin={() => {
          void membership.requestJoin();
        }}
        returnTo={returnTo}
        teamName={teamName}
        viewer={viewer}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {hasClaimedProfile ? (
        !isAdmin && <p className="text-sm text-muted-foreground">You are a member of this team.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Your profile isn&apos;t on this team yet</p>
          <AddOwnProfileButton teamId={teamId} />
        </div>
      )}
      {isAdmin && (
        <>
          <JoinRequestsPanel teamId={teamId} />
          <PendingInvitationsPanel members={members} teamId={teamId} />
        </>
      )}
    </div>
  );
};
