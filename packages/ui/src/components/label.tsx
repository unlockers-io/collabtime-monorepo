import * as React from "react";

import { cn } from "../lib/utils";

const Label = ({
  className,
  treatment = "default",
  ...props
}: React.ComponentProps<"label"> & { treatment?: "default" | "field" }) => {
  return (
    // Generic wrapper: callers are responsible for passing `htmlFor` or
    // wrapping the associated control. jsx-a11y can't see that statically.
    // oxlint-disable-next-line jsx-a11y/label-has-associated-control
    <label
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        treatment === "field" &&
          "group/field-label w-fit leading-snug text-foreground group-data-[invalid=true]/field:text-destructive",
        className,
      )}
      data-slot="label"
      {...props}
    />
  );
};

export { Label };
