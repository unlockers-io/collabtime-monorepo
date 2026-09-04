import type { ComponentProps } from "react";

import { cn } from "../lib/utils";

const Card = ({
  className,
  size = "default",
  ...props
}: ComponentProps<"div"> & { size?: "default" | "sm" }) => {
  return (
    <div
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden border-y border-border bg-transparent py-(--card-spacing) text-sm text-card-foreground [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0",
        className,
      )}
      data-size={size}
      data-slot="card"
      {...props}
    />
  );
};

const CardHeader = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className,
      )}
      data-slot="card-header"
      {...props}
    />
  );
};

const CardTitle = ({ children, className, ...props }: ComponentProps<"h2">) => {
  return (
    <h2
      className={cn(
        "text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className,
      )}
      data-slot="card-title"
      {...props}
    >
      {children}
    </h2>
  );
};

const CardDescription = ({ className, ...props }: ComponentProps<"p">) => {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      data-slot="card-description"
      {...props}
    />
  );
};

const CardAction = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      data-slot="card-action"
      {...props}
    />
  );
};

const CardContent = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div className={cn("px-(--card-spacing)", className)} data-slot="card-content" {...props} />
  );
};

const CardFooter = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      className={cn("flex items-center border-t bg-muted/30 p-(--card-spacing)", className)}
      data-slot="card-footer"
      {...props}
    />
  );
};

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
