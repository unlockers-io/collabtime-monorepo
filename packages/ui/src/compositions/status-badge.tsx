import { cn } from "cn";
import type { ComponentProps } from "react";

import { badgeVariants } from "../components/badge";

const tones = {
  info: "bg-info/15 text-info",
  pending: "bg-warning/30 text-warning",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
};

type StatusBadgeProps = ComponentProps<"span"> & {
  numeric?: boolean;
  tone: keyof typeof tones;
};

const StatusBadge = ({ className, numeric = false, tone, ...props }: StatusBadgeProps) => (
  <span
    className={cn(
      badgeVariants({ variant: "secondary" }),
      tones[tone],
      numeric && "font-mono tabular-nums",
      className,
    )}
    data-slot="status-badge"
    {...props}
  />
);

export { StatusBadge };
