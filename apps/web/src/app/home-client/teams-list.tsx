"use client";

import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Archive, MoreHorizontal, Shield, Trash2, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";

import type { MyTeam, WorkspaceToDelete } from "./types";

type TeamsListProps = {
  onArchive: (team: MyTeam) => void;
  onRequestDelete: (workspace: WorkspaceToDelete) => void;
  processingArchive: Set<string>;
  teams: Array<MyTeam>;
};

const TeamsList = ({ onArchive, onRequestDelete, processingArchive, teams }: TeamsListProps) => (
  <AnimatePresence>
    {teams.length > 0 && (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex w-full flex-col gap-3"
        exit={{ opacity: 0, y: -10 }}
        initial={{ opacity: 0, y: 20 }}
        transition={{
          delay: 0.3,
          duration: 0.6,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">My Teams</h2>
        </div>

        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {teams.map((team) => {
              const isArchivePending = processingArchive.has(team.teamId);
              return (
                <motion.div
                  animate={{ opacity: 1, scale: 1 }}
                  className="group flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-colors hover:border-input"
                  exit={{ opacity: 0, scale: 0.95 }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  key={team.teamId}
                  layout
                  transition={{ duration: 0.2 }}
                >
                  <Link className="flex flex-1 items-center gap-3" href={`/${team.teamId}`}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">
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
                    {team.role === "ADMIN" && (
                      <Shield aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                    )}
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
                          onClick={() => onArchive(team)}
                        >
                          <Archive />
                          Archive
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
                            Delete workspace
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export { TeamsList };
