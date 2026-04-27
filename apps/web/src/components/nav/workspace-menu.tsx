"use client";

import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { MoreHorizontal, Trash2 } from "lucide-react";

type WorkspaceMenuProps = {
  onDeleteWorkspace: () => void;
};

const WorkspaceMenu = ({ onDeleteWorkspace }: WorkspaceMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={<Button aria-label="Workspace actions" size="icon" variant="outline" />}
    >
      <MoreHorizontal className="h-4 w-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48 bg-popover">
      <DropdownMenuItem onClick={onDeleteWorkspace} variant="destructive">
        <Trash2 />
        Delete workspace
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export { WorkspaceMenu };
