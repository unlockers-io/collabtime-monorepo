import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";
import type { ComponentProps, ComponentType, ReactNode, SVGProps } from "react";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type SectionCardProps = ComponentProps<"section">;

const SectionCard = ({ className, ...props }: SectionCardProps) => {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card py-4 text-card-foreground shadow-sm sm:py-5",
        className,
      )}
      data-slot="section-card"
      {...props}
    />
  );
};

type SectionCardHeaderProps = ComponentProps<"div"> & {
  bordered?: boolean;
};

const SectionCardHeader = ({ bordered, className, ...props }: SectionCardHeaderProps) => {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-4 sm:px-5",
        bordered && "border-b pb-4 sm:pb-5",
        className,
      )}
      data-slot="section-card-header"
      {...props}
    />
  );
};

type SectionCardTitleProps = {
  children: ReactNode;
  description?: ReactNode;
  icon?: IconComponent;
};

const SectionCardTitle = ({ children, description, icon: Icon }: SectionCardTitleProps) => {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
        {children}
      </h2>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
};

type SectionCardCountProps = ComponentProps<"span">;

const SectionCardCount = ({ children, className, ...props }: SectionCardCountProps) => {
  return (
    <Badge className={cn("tabular-nums", className)} variant="secondary" {...props}>
      {children}
    </Badge>
  );
};

type SectionCardContentProps = ComponentProps<"div">;

const SectionCardContent = ({ className, ...props }: SectionCardContentProps) => {
  return (
    <div className={cn("px-4 sm:px-5", className)} data-slot="section-card-content" {...props} />
  );
};

type SectionCardFooterProps = ComponentProps<"div"> & {
  bordered?: boolean;
};

const SectionCardFooter = ({ bordered, className, ...props }: SectionCardFooterProps) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 sm:px-5",
        bordered && "border-t pt-4 sm:pt-5",
        className,
      )}
      data-slot="section-card-footer"
      {...props}
    />
  );
};

export {
  SectionCard,
  SectionCardContent,
  SectionCardCount,
  SectionCardFooter,
  SectionCardHeader,
  SectionCardTitle,
};
