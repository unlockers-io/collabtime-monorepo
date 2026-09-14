import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";
import type { ComponentProps, ComponentType, ReactNode, SVGProps } from "react";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type SectionCardProps = ComponentProps<"section">;

const SectionCard = ({ className, ...props }: SectionCardProps) => {
  return (
    <section
      className={cn("flex flex-col gap-5 border-t border-border pt-5 sm:pt-6", className)}
      data-slot="section-card"
      {...props}
    />
  );
};

type SectionCardHeaderProps = ComponentProps<"div">;

const SectionCardHeader = ({ className, ...props }: SectionCardHeaderProps) => {
  return (
    <div
      className={cn("flex items-start justify-between gap-3", className)}
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
    <Badge className={className} numeric variant="secondary" {...props}>
      {children}
    </Badge>
  );
};

type SectionCardContentProps = ComponentProps<"div">;

const SectionCardContent = ({ className, ...props }: SectionCardContentProps) => {
  return <div className={cn(className)} data-slot="section-card-content" {...props} />;
};

type SectionCardFooterProps = ComponentProps<"div">;

const SectionCardFooter = ({ className, ...props }: SectionCardFooterProps) => {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-t border-border pt-4 sm:pt-5",
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
