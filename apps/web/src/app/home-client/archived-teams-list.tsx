"use client";

import { cn } from "@repo/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useId, useState } from "react";

import type { MyTeam, WorkspaceToDelete } from "./types";
import { WorkspaceRow } from "./workspace-row";

type ArchivedTeamsListProps = {
  isArchivePending: boolean;
  onRequestDelete: (workspace: WorkspaceToDelete) => void;
  onUnarchive: (team: MyTeam) => void;
  teams: Array<MyTeam>;
};

const ArchivedTeamsList = ({
  isArchivePending,
  onRequestDelete,
  onUnarchive,
  teams,
}: ArchivedTeamsListProps) => {
  const [showArchived, setShowArchived] = useState(false);
  const listId = useId();

  if (teams.length === 0) {
    return null;
  }

  const count = `${teams.length} archived workspace${teams.length === 1 ? "" : "s"}`;

  return (
    <div className="flex w-full flex-col gap-3 border-t border-border pt-5">
      <button
        aria-controls={listId}
        aria-expanded={showArchived}
        className="flex items-center justify-between text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        onClick={() => {
          setShowArchived((prev) => !prev);
        }}
        type="button"
      >
        <span>
          {showArchived ? "Hide" : "Show"} {count}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 transition-transform", showArchived ? "rotate-180" : "rotate-0")}
        />
      </button>

      <AnimatePresence initial={false}>
        {showArchived && (
          <m.ul
            animate={{ opacity: 1 }}
            className="flex flex-col divide-y divide-border"
            exit={{ opacity: 0 }}
            id={listId}
            initial={{ opacity: 0 }}
            key="archived-list"
            transition={{ duration: 0.15 }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {teams.map((team) => (
                <WorkspaceRow
                  isArchived
                  isArchivePending={isArchivePending}
                  key={team.teamId}
                  onRequestDelete={onRequestDelete}
                  onToggleArchive={onUnarchive}
                  team={team}
                />
              ))}
            </AnimatePresence>
          </m.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export { ArchivedTeamsList };
