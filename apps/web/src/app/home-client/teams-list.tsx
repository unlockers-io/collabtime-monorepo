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

import { SectionCard, SectionCardHeader, SectionCardTitle } from "@/components/section-card";

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
        <SectionCard>
          <SectionCardHeader>
            <SectionCardTitle>Active workspaces</SectionCardTitle>
          </SectionCardHeader>
          <div className="flex flex-col divide-y divide-border">
            <AnimatePresence mode="popLayout">
              {teams.map((team) => {
                return (
                  <m.div
                    animate={{ opacity: 1 }}
                    className="group relative isolate flex min-h-24 items-center justify-between py-5 before:absolute before:-inset-x-4 before:inset-y-0 before:-z-10 before:rounded-lg before:bg-transparent before:transition-colors focus-within:before:bg-muted/40 hover:before:bg-muted/40"
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
                        <span className="font-display text-xl font-semibold tracking-display text-foreground">
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
        </SectionCard>
      </m.div>
    )}
  </AnimatePresence>
);

export { TeamsList };
