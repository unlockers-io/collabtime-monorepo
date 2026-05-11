"use client";

import { Button } from "@repo/ui/components/button";
import { Check, Copy } from "lucide-react";

type CopyLinkButtonProps = {
  hasCopied: boolean;
  onCopy: () => void;
  onMobileClose?: () => void;
};

const CopyLinkButton = ({ hasCopied, onCopy, onMobileClose }: CopyLinkButtonProps) => (
  <Button
    className="justify-start"
    onClick={() => {
      onCopy();
      onMobileClose?.();
    }}
    variant="outline"
  >
    <span className="flex items-center gap-2">
      {hasCopied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
      {hasCopied ? "Copied!" : "Copy Link"}
    </span>
  </Button>
);

export { CopyLinkButton };
