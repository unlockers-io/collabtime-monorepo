"use client";

import { Button } from "@repo/ui/components/button";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { Check, Copy } from "lucide-react";

type CopyLinkButtonProps = {
  hasCopied: boolean;
  onCopy: () => void;
  variant: "ghost" | "outline";
};

const CopyLinkButton = ({ hasCopied, onCopy, variant }: CopyLinkButtonProps) => {
  const ready = useClientReady();

  return (
    <Button className="justify-start" disabled={!ready} onClick={onCopy} variant={variant}>
      <span className="flex items-center gap-2">
        {hasCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {hasCopied ? "Copied" : "Copy link"}
      </span>
    </Button>
  );
};

export { CopyLinkButton };
