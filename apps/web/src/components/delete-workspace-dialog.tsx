"use client";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Spinner } from "@repo/ui/components/spinner";
import { useState } from "react";
import { toast } from "sonner";

type DeleteWorkspaceDialogProps = {
  onDeleted?: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  spaceId: string;
  teamName: string;
};

const DeleteWorkspaceDialog = ({
  onDeleted,
  onOpenChange,
  open,
  spaceId,
  teamName,
}: DeleteWorkspaceDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const displayName = teamName.trim() || "this workspace";

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/spaces/${spaceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "Failed to delete workspace");
        return;
      }

      toast.success("Workspace deleted");
      onOpenChange(false);
      await onDeleted?.();
    } catch {
      toast.error("Failed to delete workspace");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (isDeleting) {
      return;
    }
    onOpenChange(next);
  };

  return (
    // Controlled: open state is owned by the parent so it can pass workspace
    // identity (spaceId + name) alongside the open flag from row-level
    // dropdown menu items, and so closing can be blocked while a delete is in
    // flight.
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this workspace?</DialogTitle>
          <DialogDescription>
            {`\u201C${displayName}\u201D will be permanently deleted, along with all members, invitations, and pending join requests. This can\u2019t be undone.`}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={isDeleting} onClick={handleDelete} type="button" variant="destructive">
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Deleting...
              </span>
            ) : (
              "Delete workspace"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { DeleteWorkspaceDialog };
