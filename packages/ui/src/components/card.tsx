import * as React from "react";

import { cn } from "../lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("ui:rounded-2xl ui:border ui:border-border ui:bg-card ui:shadow-sm", className)}
    {...props}
  />
));
Card.displayName = "Card";

export { Card };
