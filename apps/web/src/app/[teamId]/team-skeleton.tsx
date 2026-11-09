"use client";

import { Skeleton } from "skullet/react";

import { DEMO_GROUPS, DEMO_MEMBERS } from "@/components/landing/demo-team";

import { TeamWorkspace } from "./team-workspace";

const ignore = () => {};

const TeamSkeleton = () => (
  <Skeleton label="Loading workspace" loading>
    <TeamWorkspace
      activeDragType={null}
      collapsedGroupIds={[]}
      excludedMemberIds={[]}
      groups={DEMO_GROUPS}
      isPrivate={false}
      members={DEMO_MEMBERS}
      membership={{
        currentUserId: undefined,
        hasClaimedProfile: true,
        isAdmin: false,
        isMember: true,
        isRequestingJoin: false,
        navRole: "member",
        requestJoin: () => Promise.resolve(),
      }}
      onExcludedMemberIdsChange={ignore}
      onToggleGroupCollapse={ignore}
      owner={null}
      returnTo="/"
      teamId="sample-workspace"
      teamName="Sample workspace"
      viewer={{ isArchived: false, status: "MEMBER", userId: null }}
    />
  </Skeleton>
);

export { TeamSkeleton };
