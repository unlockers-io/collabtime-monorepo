"use client";

import { Button } from "@repo/ui/components/button";
import { Pencil } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { useInlineRename } from "@/hooks/use-inline-rename";
import { useTeamWrite } from "@/hooks/use-team-write";
import { workspaceName } from "@/lib/display-name";
import { TEAM_NAME_MAX_LENGTH } from "@/lib/limits";

type TeamTitleProps = {
  isAdmin: boolean;
  teamId: string;
  teamName: string;
};

const TeamTitle = ({ isAdmin, teamId, teamName }: TeamTitleProps) => {
  const write = useTeamWrite(teamId);
  const [, startTransition] = useTransition();

  const rename = useInlineRename(teamName, (name) => {
    startTransition(async () => {
      const result = await write.change("renameTeam", { name });

      if (!result.success) {
        toast.error(result.error);
      }
    });
  });

  const heading = (
    <h1 className="min-w-0 font-display text-4xl font-semibold tracking-hero text-balance wrap-break-word sm:text-6xl">
      {workspaceName(teamName)}
    </h1>
  );

  if (!isAdmin) {
    return heading;
  }

  if (rename.inputProps !== null) {
    return (
      <input
        {...rename.inputProps}
        aria-label="Workspace name"
        autoFocus
        className="h-14 w-full max-w-xl border border-input bg-background px-3 font-display text-3xl font-semibold tracking-hero text-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 focus:outline-none sm:h-18 sm:text-5xl"
        maxLength={TEAM_NAME_MAX_LENGTH}
        placeholder="Workspace name"
        type="text"
      />
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {heading}
      <Button
        aria-label="Rename workspace"
        className="shrink-0"
        onClick={rename.handleStart}
        size="icon-sm"
        variant="ghost"
      >
        <Pencil aria-hidden className="size-4" />
      </Button>
    </div>
  );
};

export { TeamTitle };
