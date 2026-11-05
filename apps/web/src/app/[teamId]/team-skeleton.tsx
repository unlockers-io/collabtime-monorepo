"use client";

import { Skeleton } from "skullet/react";

import { DEMO_GROUPS, DEMO_MEMBERS } from "@/components/landing/demo-team";

import { TeamWorkspace } from "./team-workspace";

const SAMPLE_TEAM_NAME = "Sample workspace";

const ignore = () => {};

const TeamSkeleton = () => (
  <Skeleton label="Loading workspace" loading>
    <TeamWorkspace
      activeDragType={null}
      collapsedGroupIds={[]}
      excludedMemberIds={[]}
      groups={DEMO_GROUPS}
      membership={{
        hasClaimedProfile: true,
        isAdmin: false,
        isAuthenticated: true,
        isMember: true,
        isRequestingJoin: false,
        members: DEMO_MEMBERS,
        onRequestJoin: ignore,
        returnTo: "/",
        teamId: "sample-workspace",
        teamName: SAMPLE_TEAM_NAME,
        teamStatus: "MEMBER",
      }}
      nav={{
        isAdmin: false,
        isAuthenticated: true,
        isEditingName: false,
        onCancelEdit: ignore,
        onEditName: ignore,
        onNameChange: ignore,
        onSaveName: ignore,
        teamName: SAMPLE_TEAM_NAME,
        variant: "team",
      }}
      onExcludedMemberIdsChange={ignore}
      onToggleGroupCollapse={ignore}
    />
  </Skeleton>
);

export { TeamSkeleton };
