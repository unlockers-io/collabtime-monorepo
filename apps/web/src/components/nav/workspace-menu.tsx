"use client";

import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Lock, MoreHorizontal, Trash2 } from "lucide-react";

type WorkspaceMenuProps = {
  onDeleteWorkspace: () => void;
  onEditVisibility?: () => void;
};

const WorkspaceMenu = ({ onDeleteWorkspace, onEditVisibility }: WorkspaceMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={<Button aria-label="Workspace actions" size="icon" variant="outline" />}
    >
      <MoreHorizontal className="size-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      {onEditVisibility && (
        <DropdownMenuItem onClick={onEditVisibility}>
          <Lock />
          Sharing &amp; privacy
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={onDeleteWorkspace} variant="destructive">
        <Trash2 />
        Delete workspace
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export { WorkspaceMenu };
