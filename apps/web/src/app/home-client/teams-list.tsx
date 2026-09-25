"use client";

import { AnimatePresence } from "motion/react";

import { SectionCard, SectionCardHeader, SectionCardTitle } from "@/components/section-card";

import type { MyTeam, WorkspaceToDelete } from "./types";
import { WorkspaceRow } from "./workspace-row";

type TeamsListProps = {
  isArchivePending: boolean;
  onArchive: (team: MyTeam) => void;
  onRequestDelete: (workspace: WorkspaceToDelete) => void;
  teams: Array<MyTeam>;
};

const TeamsList = ({ isArchivePending, onArchive, onRequestDelete, teams }: TeamsListProps) => {
  if (teams.length === 0) {
    return null;
  }

  return (
    <SectionCard>
      <SectionCardHeader>
        <SectionCardTitle>Active workspaces</SectionCardTitle>
      </SectionCardHeader>
      <ul className="flex flex-col divide-y divide-border">
        {/* Rows only animate when one leaves or joins, never on page load. */}
        <AnimatePresence initial={false} mode="popLayout">
          {teams.map((team) => (
            <WorkspaceRow
              isArchivePending={isArchivePending}
              key={team.teamId}
              onRequestDelete={onRequestDelete}
              onToggleArchive={onArchive}
              team={team}
            />
          ))}
        </AnimatePresence>
      </ul>
    </SectionCard>
  );
};

export { TeamsList };
