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

type ConfirmRemoveDialogProps = {
  confirmLabel: string;
  description: string;
  isPending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

/** Cancel comes first so it takes initial focus; removal is never the default. */
const ConfirmRemoveDialog = ({
  confirmLabel,
  description,
  isPending,
  onConfirm,
  onOpenChange,
  open,
  title,
}: ConfirmRemoveDialogProps) => (
  <Dialog
    onOpenChange={(next) => {
      if (!isPending) {
        onOpenChange(next);
      }
    }}
    open={open}
  >
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          disabled={isPending}
          onClick={() => {
            onOpenChange(false);
          }}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        <Button disabled={isPending} onClick={onConfirm} type="button" variant="destructive">
          {isPending ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Removing…
            </span>
          ) : (
            confirmLabel
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export { ConfirmRemoveDialog };
