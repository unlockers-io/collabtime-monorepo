import * as React from "react";

import { cn } from "../lib/utils";

const Label = ({ className, ...props }: React.ComponentProps<"label">) => {
  return (
    // Generic wrapper: callers are responsible for passing `htmlFor` or
    // wrapping the associated control. jsx-a11y can't see that statically.
    // oxlint-disable-next-line jsx-a11y/label-has-associated-control
    <label
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      data-slot="label"
      {...props}
    />
  );
};

export { Label };
