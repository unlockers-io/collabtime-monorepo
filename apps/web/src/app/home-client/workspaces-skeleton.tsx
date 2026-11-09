"use client";

import { SkeletonSuspense } from "skullet/react";

import type { MyTeam } from "@/lib/home-lists";

import { TeamsList } from "./teams-list";

const SAMPLE_TEAMS: Array<MyTeam> = [
  {
    archivedAt: null,
    memberCount: 8,
    role: "ADMIN",
    spaceId: null,
    teamId: "sample-product",
    teamName: "Product team",
  },
  {
    archivedAt: null,
    memberCount: 12,
    role: "MEMBER",
    spaceId: null,
    teamId: "sample-engineering",
    teamName: "Engineering",
  },
];

const ignore = () => {};

type WorkspacesSkeletonProps = {
  children: React.ReactNode;
};

const WorkspacesSkeleton = ({ children }: WorkspacesSkeletonProps) => (
  <SkeletonSuspense
    label="Loading your workspaces"
    skeleton={
      // Client navigations mount the sample's links, and their hrefs lead nowhere.
      <TeamsList
        isArchivePending={false}
        onArchive={ignore}
        onRequestDelete={ignore}
        prefetch={false}
        teams={SAMPLE_TEAMS}
      />
    }
  >
    {children}
  </SkeletonSuspense>
);

export { WorkspacesSkeleton };
