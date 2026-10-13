"use client";

import { Button } from "@repo/ui/components/button";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { Check, Copy } from "lucide-react";

type CopyLinkButtonProps = {
  hasCopied: boolean;
  onCopy: () => void;
  onMobileClose?: () => void;
};

const CopyLinkButton = ({ hasCopied, onCopy, onMobileClose }: CopyLinkButtonProps) => {
  const ready = useClientReady();

  return (
    <Button
      className="justify-start"
      disabled={!ready}
      onClick={() => {
        onCopy();
        onMobileClose?.();
      }}
      variant="outline"
    >
      <span className="flex items-center gap-2">
        {hasCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {hasCopied ? "Copied" : "Copy link"}
      </span>
    </Button>
  );
};

export { CopyLinkButton };
