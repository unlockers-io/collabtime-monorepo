import * as React from "react";
import { cn } from "../lib/utils";

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-xs font-medium text-neutral-600 dark:text-neutral-400",
        className
      )}
      {...props}
    />
  )
);
Label.displayName = "Label";

export { Label };
