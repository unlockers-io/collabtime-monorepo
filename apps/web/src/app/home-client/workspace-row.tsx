"use client";

import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { Archive, ArchiveRestore, ChevronRight, MoreHorizontal, Trash2 } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { useId } from "react";

import type { MyTeam, WorkspaceToDelete } from "./types";

const memberCountLabel = (count: number): string => {
  if (count === 0) {
    return "No members";
  }
  return `${count} member${count === 1 ? "" : "s"}`;
};

type WorkspaceRowProps = {
  isArchived?: boolean;
  isArchivePending: boolean;
  onRequestDelete: (workspace: WorkspaceToDelete) => void;
  onToggleArchive: (team: MyTeam) => void;
  team: MyTeam;
};

// The link's ::after covers the whole row, so any point on it opens the workspace;
// the menu sits in a positioned wrapper above that overlay and stays clickable.
const WorkspaceRow = ({
  isArchived = false,
  isArchivePending,
  onRequestDelete,
  onToggleArchive,
  team,
}: WorkspaceRowProps) => {
  const detailsId = useId();
  const name = team.teamName || "Untitled workspace";
  const { spaceId } = team;

  return (
    <m.li
      animate={{ opacity: 1 }}
      className="group relative isolate flex min-h-20 items-center gap-3 py-4 before:absolute before:-inset-x-4 before:inset-y-0 before:-z-10 before:rounded-lg before:bg-transparent before:transition-colors focus-within:before:bg-muted/40 hover:before:bg-muted/40"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      layout
      transition={{ duration: 0.12 }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          aria-describedby={detailsId}
          className={cn(
            "truncate outline-none after:absolute after:-inset-x-4 after:inset-y-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring",
            isArchived
              ? "text-base font-medium text-muted-foreground"
              : "font-display text-xl font-semibold tracking-display text-foreground",
          )}
          href={`/${team.teamId}`}
          prefetch={!isArchived}
        >
          {name}
        </Link>
        <p className="text-xs text-muted-foreground" id={detailsId}>
          {memberCountLabel(team.memberCount)}
          {team.role === "ADMIN" && " · Admin"}
        </p>
      </div>
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
      />
      <div className="relative">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button aria-label={`More actions for ${name}`} size="icon-sm" variant="ghost" />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuItem
              disabled={isArchivePending}
              onClick={() => {
                onToggleArchive(team);
              }}
            >
              {isArchived ? <ArchiveRestore /> : <Archive />}
              {isArchived ? "Unarchive" : "Archive"}
            </DropdownMenuItem>
            {spaceId !== null && spaceId !== "" && (
              <DropdownMenuItem
                onClick={() => {
                  onRequestDelete({ spaceId, teamName: team.teamName });
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
    </m.li>
  );
};

export { WorkspaceRow };
