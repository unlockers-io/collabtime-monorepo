import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "text-destructive-foreground border-transparent bg-destructive",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

const Badge = ({ className, variant, ...props }: BadgeProps) => {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
};

export { Badge, badgeVariants };
