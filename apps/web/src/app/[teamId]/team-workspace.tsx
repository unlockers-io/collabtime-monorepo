"use client";

import { Clock, FolderKanban, Users } from "lucide-react";

import { AddGroupDialog } from "@/components/add-group-dialog";
import { AddMemberDialog } from "@/components/add-member-dialog";
import { ImportMembersDialog } from "@/components/import-members-dialog";
import {
  SectionCard,
  SectionCardContent,
  SectionCardCount,
  SectionCardFooter,
  SectionCardHeader,
  SectionCardTitle,
} from "@/components/section-card";
import { TeamInsights } from "@/components/team-insights";
import { TimezoneVisualizer } from "@/components/timezone-visualizer";
import { ViewerZoneNote } from "@/components/timezone-visualizer/viewer-zone-note";
import type { TeamGroup, TeamMember } from "@/types";

import { GroupsGrid } from "./client/groups-grid";
import { MembersGrid } from "./client/members-grid";
import { MembershipActions } from "./client/membership-actions";
import type { TeamMembership } from "./client/use-team-membership";
import type { OwnerActions } from "./nav/workspace-menu";
import { TeamNav } from "./team-nav";
import type { TeamPageViewer } from "./viewer";

type TeamWorkspaceProps = {
  activeDragType: "group" | "member" | null;
  collapsedGroupIds: ReadonlyArray<string>;
  excludedMemberIds: ReadonlyArray<string>;
  groups: Array<TeamGroup>;
  isPrivate: boolean;
  members: Array<TeamMember>;
  membership: TeamMembership;
  onExcludedMemberIdsChange: (memberIds: Array<string>) => void;
  onToggleGroupCollapse: (groupId: string) => void;
  owner: OwnerActions | null;
  returnTo: string;
  teamId: string;
  teamName: string;
  viewer: TeamPageViewer;
};

const TeamWorkspace = ({
  activeDragType,
  collapsedGroupIds,
  excludedMemberIds,
  groups,
  isPrivate,
  members,
  membership,
  onExcludedMemberIdsChange,
  onToggleGroupCollapse,
  owner,
  returnTo,
  teamId,
  teamName,
  viewer,
}: TeamWorkspaceProps) => {
  const { currentUserId, hasClaimedProfile, isAdmin } = membership;
  const orderedMembers = [...members].toSorted((a, b) => a.order - b.order);
  const orderedGroups = [...groups].toSorted((a, b) => a.order - b.order);

  return (
    <div className="min-h-dvh w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
      <main className="mx-auto flex w-full max-w-450 flex-col gap-10" id="main">
        <TeamNav
          isArchived={viewer.isArchived}
          isPrivate={isPrivate}
          navRole={membership.navRole}
          owner={owner}
          teamId={teamId}
          teamName={teamName}
        />

        {members.length > 0 && (
          <SectionCard>
            <SectionCardHeader>
              <SectionCardTitle description={<ViewerZoneNote />} icon={Clock}>
                Working hours
              </SectionCardTitle>
            </SectionCardHeader>
            <SectionCardContent>
              <TimezoneVisualizer
                collapsedGroupIds={collapsedGroupIds}
                excludedMemberIds={excludedMemberIds}
                groups={groups}
                members={orderedMembers}
                onExcludedMemberIdsChange={onExcludedMemberIdsChange}
                onToggleGroupCollapse={onToggleGroupCollapse}
              />
            </SectionCardContent>
          </SectionCard>
        )}

        {members.length > 0 && <TeamInsights groups={groups} members={orderedMembers} />}

        <div className="grid grid-cols-1 items-start gap-10 xl:grid-cols-team [&>*]:min-w-0">
          <SectionCard>
            <SectionCardHeader>
              <SectionCardTitle icon={Users}>Team members</SectionCardTitle>
              <SectionCardCount>{members.length}</SectionCardCount>
            </SectionCardHeader>
            <SectionCardContent className="flex flex-col gap-4">
              <MembersGrid
                currentUserId={currentUserId}
                groups={groups}
                hasClaimedProfile={hasClaimedProfile}
                isAdmin={isAdmin}
                orderedMembers={orderedMembers}
                teamId={teamId}
              />

              <MembershipActions
                members={members}
                membership={membership}
                returnTo={returnTo}
                teamId={teamId}
                teamName={teamName}
                viewer={viewer}
              />
            </SectionCardContent>
            {isAdmin && (
              <SectionCardFooter className="justify-end">
                <ImportMembersDialog teamId={teamId} />
                <AddMemberDialog
                  groups={groups}
                  isFirstMember={members.length === 0}
                  teamId={teamId}
                />
              </SectionCardFooter>
            )}
          </SectionCard>

          <SectionCard>
            <SectionCardHeader>
              <SectionCardTitle icon={FolderKanban}>Groups</SectionCardTitle>
              <SectionCardCount>{groups.length}</SectionCardCount>
            </SectionCardHeader>
            <SectionCardContent>
              <GroupsGrid
                activeDragType={activeDragType}
                isAdmin={isAdmin}
                members={members}
                orderedGroups={orderedGroups}
                teamId={teamId}
              />
            </SectionCardContent>
            {isAdmin && (
              <SectionCardFooter className="justify-end">
                <AddGroupDialog teamId={teamId} />
              </SectionCardFooter>
            )}
          </SectionCard>
        </div>
      </main>
    </div>
  );
};

export { TeamWorkspace };
