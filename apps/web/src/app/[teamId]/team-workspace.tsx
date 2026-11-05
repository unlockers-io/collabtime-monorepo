"use client";

import { Clock, FolderKanban, Users } from "lucide-react";
import type { ComponentProps } from "react";

import { AddGroupDialog } from "@/components/add-group-dialog";
import { AddMemberDialog } from "@/components/add-member-dialog";
import { ImportMembersDialog } from "@/components/import-members-dialog";
import { Nav } from "@/components/nav";
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
import type { TeamGroup } from "@/types";

import { GroupsGrid } from "./client/groups-grid";
import { MembersGrid } from "./client/members-grid";
import { MembershipActions } from "./client/membership-actions";

type TeamWorkspaceProps = {
  activeDragType: "group" | "member" | null;
  collapsedGroupIds: ReadonlyArray<string>;
  currentUserId?: string;
  excludedMemberIds: ReadonlyArray<string>;
  groups: Array<TeamGroup>;
  membership: ComponentProps<typeof MembershipActions>;
  nav: Extract<ComponentProps<typeof Nav>, { variant: "team" }>;
  onExcludedMemberIdsChange: (memberIds: Array<string>) => void;
  onToggleGroupCollapse: (groupId: string) => void;
};

const TeamWorkspace = ({
  activeDragType,
  collapsedGroupIds,
  currentUserId,
  excludedMemberIds,
  groups,
  membership,
  nav,
  onExcludedMemberIdsChange,
  onToggleGroupCollapse,
}: TeamWorkspaceProps) => {
  const { hasClaimedProfile, isAdmin, members, teamId } = membership;
  const orderedMembers = [...members].toSorted((a, b) => a.order - b.order);
  const orderedGroups = [...groups].toSorted((a, b) => a.order - b.order);

  return (
    <div className="min-h-dvh w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
      <main className="mx-auto flex w-full max-w-450 flex-col gap-10" id="main">
        <Nav {...nav} />

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

              <MembershipActions {...membership} />
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
