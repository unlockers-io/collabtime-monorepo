"use client";

import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Archive, ArrowUpRight, MoreHorizontal, Shield, Trash2 } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";

import type { MyTeam, WorkspaceToDelete } from "./types";

type TeamsListProps = {
  isArchivePending: boolean;
  onArchive: (team: MyTeam) => void;
  onRequestDelete: (workspace: WorkspaceToDelete) => void;
  teams: Array<MyTeam>;
};

const TeamsList = ({ isArchivePending, onArchive, onRequestDelete, teams }: TeamsListProps) => (
  <AnimatePresence>
    {teams.length > 0 && (
      <m.div
        animate={{ opacity: 1 }}
        className="flex w-full flex-col"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        transition={{
          delay: 0.3,
          duration: 0.15,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="font-display text-sm font-semibold tracking-[0.08em] text-foreground uppercase">
            Active workspaces
          </h2>
        </div>

        <div className="flex flex-col">
          <AnimatePresence mode="popLayout">
            {teams.map((team) => {
              return (
                <m.div
                  animate={{ opacity: 1 }}
                  className="group flex min-h-24 items-center justify-between border-b border-border py-5 transition-colors hover:bg-muted/40"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  key={team.teamId}
                  layout
                  transition={{ duration: 0.12 }}
                >
                  <Link
                    className="flex flex-1 items-center justify-between gap-6 pr-4"
                    href={`/${team.teamId}`}
                    prefetch
                  >
                    <div className="flex flex-col">
                      <span className="font-display text-xl font-semibold tracking-[-0.03em] text-foreground">
                        {team.teamName || "Team Workspace"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {team.memberCount === 0
                          ? "Empty"
                          : `${team.memberCount} member${team.memberCount === 1 ? "" : "s"}`}
                      </span>
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                  </Link>
                  <div className="flex items-center gap-1 pl-2">
                    {team.role === "ADMIN" && (
                      <Shield aria-hidden="true" className="size-4 text-muted-foreground" />
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
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={4}>
                        <DropdownMenuItem
                          disabled={isArchivePending}
                          onClick={() => {
                            onArchive(team);
                          }}
                        >
                          <Archive />
                          Archive
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
        </div>
      </m.div>
    )}
  </AnimatePresence>
);

export { TeamsList };
