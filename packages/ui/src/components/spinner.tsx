import { cn } from "cn";
import { Loader2Icon } from "lucide-react";

const Spinner = ({ className, ...props }: React.ComponentProps<"svg">) => {
  return (
    <Loader2Icon
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      data-slot="spinner"
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Preserve the upstream SVG loading icon and its status announcement.
      role="status"
      {...props}
    />
  );
};

export { Spinner };
