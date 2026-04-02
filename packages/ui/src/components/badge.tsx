import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const badgeVariants = cva(
  "ui:inline-flex ui:w-fit ui:shrink-0 ui:items-center ui:justify-center ui:gap-1 ui:overflow-hidden ui:rounded-full ui:border ui:px-2 ui:py-0.5 ui:text-xs ui:font-medium ui:whitespace-nowrap ui:transition-[color,box-shadow] ui:focus-visible:border-ring ui:focus-visible:ring-[3px] ui:focus-visible:ring-ring/50 ui:[&>svg]:pointer-events-none ui:[&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "ui:border-transparent ui:bg-primary ui:text-primary-foreground",
        secondary: "ui:border-transparent ui:bg-secondary ui:text-secondary-foreground",
        destructive: "ui:text-destructive-foreground ui:border-transparent ui:bg-destructive",
        outline: "ui:border-border ui:text-foreground",
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
