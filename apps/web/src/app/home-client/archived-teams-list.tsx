"use client";

import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { Archive, ArchiveRestore, ChevronDown, MoreHorizontal, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import type { MyTeam, WorkspaceToDelete } from "./types";

type ArchivedTeamsListProps = {
  onRequestDelete: (workspace: WorkspaceToDelete) => void;
  onUnarchive: (team: MyTeam) => void;
  processingArchive: Set<string>;
  teams: Array<MyTeam>;
};

const ArchivedTeamsList = ({
  onRequestDelete,
  onUnarchive,
  processingArchive,
  teams,
}: ArchivedTeamsListProps) => {
  const [showArchived, setShowArchived] = useState(false);

  return (
    <AnimatePresence>
      {teams.length > 0 && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex w-full flex-col gap-3"
          exit={{ opacity: 0, y: -10 }}
          initial={{ opacity: 0, y: 20 }}
          transition={{
            delay: 0.4,
            duration: 0.6,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <button
            aria-expanded={showArchived}
            className="flex items-center justify-between rounded-md text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={() => setShowArchived((prev) => !prev)}
            type="button"
          >
            <span>
              {teams.length} archived &mdash; {showArchived ? "Hide" : "Show"}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "h-4 w-4 transition-transform",
                showArchived ? "rotate-180" : "rotate-0",
              )}
            />
          </button>

          <AnimatePresence initial={false}>
            {showArchived && (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="flex flex-col gap-2 overflow-hidden"
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
                key="archived-list"
                transition={{ duration: 0.2 }}
              >
                <AnimatePresence mode="popLayout">
                  {teams.map((team) => {
                    const isArchivePending = processingArchive.has(team.teamId);
                    return (
                      <motion.div
                        animate={{ opacity: 1, scale: 1 }}
                        className="group flex items-center justify-between rounded-xl border border-border bg-card/60 p-3 transition-colors hover:border-input"
                        exit={{ opacity: 0, scale: 0.95 }}
                        initial={{ opacity: 0, scale: 0.95 }}
                        key={team.teamId}
                        layout
                        transition={{ duration: 0.2 }}
                      >
                        <Link className="flex flex-1 items-center gap-3" href={`/${team.teamId}`}>
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                            <Archive className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-muted-foreground">
                              {team.teamName || "Team Workspace"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {team.memberCount === 0
                                ? "Empty"
                                : `${team.memberCount} member${team.memberCount !== 1 ? "s" : ""}`}
                            </span>
                          </div>
                        </Link>
                        <div className="flex items-center gap-1 pl-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  aria-label={`More actions for ${team.teamName || "this workspace"}`}
                                  size="icon-sm"
                                  variant="ghost"
                                />
                              }
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={4}>
                              <DropdownMenuItem
                                disabled={isArchivePending}
                                onClick={() => onUnarchive(team)}
                              >
                                <ArchiveRestore />
                                Unarchive
                              </DropdownMenuItem>
                              {team.spaceId && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (!team.spaceId) {
                                      return;
                                    }
                                    onRequestDelete({
                                      spaceId: team.spaceId,
                                      teamName: team.teamName,
                                    });
                                  }}
                                  variant="destructive"
                                >
                                  <Trash2 />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export { ArchivedTeamsList };
