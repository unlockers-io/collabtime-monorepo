"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-md outline-none",
      "data-[state=delayed-open]:data-[side=top]:animate-in data-[state=delayed-open]:data-[side=top]:fade-in-0 data-[state=delayed-open]:data-[side=top]:zoom-in-95",
      "data-[state=delayed-open]:data-[side=bottom]:animate-in data-[state=delayed-open]:data-[side=bottom]:fade-in-0 data-[state=delayed-open]:data-[side=bottom]:zoom-in-95",
      "data-[state=delayed-open]:data-[side=left]:animate-in data-[state=delayed-open]:data-[side=left]:fade-in-0 data-[state=delayed-open]:data-[side=left]:zoom-in-95",
      "data-[state=delayed-open]:data-[side=right]:animate-in data-[state=delayed-open]:data-[side=right]:fade-in-0 data-[state=delayed-open]:data-[side=right]:zoom-in-95",
      "dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
