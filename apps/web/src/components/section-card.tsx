import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";
import type { ComponentProps, ComponentType, ReactNode, SVGProps } from "react";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type SectionCardProps = ComponentProps<"section">;

const SectionCard = ({ className, ...props }: SectionCardProps) => {
  return (
    <section
      className={cn(
        "flex flex-col gap-5 border-y border-border bg-transparent py-5 text-card-foreground sm:py-6",
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
        "flex items-start justify-between gap-3",
        bordered === true && "border-b pb-4 sm:pb-5",
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
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold tracking-[0.08em] text-foreground uppercase">
        {Icon !== undefined && <Icon className="size-4 shrink-0 text-muted-foreground" />}
        {children}
      </h2>
      {description !== undefined &&
        description !== null &&
        description !== "" &&
        description !== false && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
};

type SectionCardCountProps = ComponentProps<"span">;

const SectionCardCount = ({ children, className, ...props }: SectionCardCountProps) => {
  return (
    <Badge className={cn("font-mono tabular-nums", className)} variant="secondary" {...props}>
      {children}
    </Badge>
  );
};

type SectionCardContentProps = ComponentProps<"div">;

const SectionCardContent = ({ className, ...props }: SectionCardContentProps) => {
  return <div className={cn(className)} data-slot="section-card-content" {...props} />;
};

type SectionCardFooterProps = ComponentProps<"div"> & {
  bordered?: boolean;
};

const SectionCardFooter = ({ bordered, className, ...props }: SectionCardFooterProps) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        bordered === true && "border-t pt-4 sm:pt-5",
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
