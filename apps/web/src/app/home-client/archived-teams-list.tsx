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
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import type { MyTeam, WorkspaceToDelete } from "./types";

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

  return (
    <AnimatePresence>
      {teams.length > 0 && (
        <m.div
          animate={{ opacity: 1 }}
          className="flex w-full flex-col gap-3 border-t border-border pt-5"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={{
            delay: 0.4,
            duration: 0.15,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <button
            aria-expanded={showArchived}
            className="flex items-center justify-between text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={() => {
              setShowArchived((prev) => !prev);
            }}
            type="button"
          >
            <span>
              {teams.length} archived &mdash; {showArchived ? "Hide" : "Show"}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-4 transition-transform",
                showArchived ? "rotate-180" : "rotate-0",
              )}
            />
          </button>

          <AnimatePresence initial={false}>
            {showArchived && (
              <m.div
                animate={{ height: "auto", opacity: 1 }}
                className="flex flex-col overflow-hidden"
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
                key="archived-list"
                transition={{ duration: 0.2 }}
              >
                <AnimatePresence mode="popLayout">
                  {teams.map((team) => {
                    return (
                      <m.div
                        animate={{ opacity: 1 }}
                        className="group flex items-center justify-between border-b border-border py-4 transition-colors hover:bg-muted/40"
                        exit={{ opacity: 0 }}
                        initial={{ opacity: 0 }}
                        key={team.teamId}
                        layout
                        transition={{ duration: 0.12 }}
                      >
                        <Link className="flex flex-1 items-center gap-3" href={`/${team.teamId}`}>
                          <Archive className="size-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-muted-foreground">
                              {team.teamName || "Team Workspace"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {team.memberCount === 0
                                ? "Empty"
                                : `${team.memberCount} member${team.memberCount === 1 ? "" : "s"}`}
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
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={4}>
                              <DropdownMenuItem
                                disabled={isArchivePending}
                                onClick={() => {
                                  onUnarchive(team);
                                }}
                              >
                                <ArchiveRestore />
                                Unarchive
                              </DropdownMenuItem>
                              {team.spaceId !== null && team.spaceId !== "" && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (team.spaceId === null || team.spaceId === "") {
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
                      </m.div>
                    );
                  })}
                </AnimatePresence>
              </m.div>
            )}
          </AnimatePresence>
        </m.div>
      )}
    </AnimatePresence>
  );
};

export { ArchivedTeamsList };
