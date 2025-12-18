"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "../lib/utils";

const useIsTouchDevice = () => {
  const [isTouch, setIsTouch] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    const handler = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsTouch(event.matches);
    };
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isTouch;
};

type TooltipContextValue = {
  isTouch: boolean;
  open: boolean;
  setOpen: (next: boolean) => void;
};

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = ({
  children,
  open: controlledOpen,
  onOpenChange,
  delayDuration,
  disableHoverableContent,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) => {
  const isTouch = useIsTouchDevice();
  const [open, setOpen] = React.useState(false);

  // Sync controlled open when provided
  React.useEffect(() => {
    if (controlledOpen === undefined) return;
    setOpen(controlledOpen);
  }, [controlledOpen]);

  return (
    <TooltipContext.Provider value={{ isTouch, open, setOpen }}>
      <TooltipPrimitive.Root
        open={isTouch ? open : controlledOpen}
        onOpenChange={isTouch ? setOpen : onOpenChange}
        delayDuration={isTouch ? 0 : delayDuration}
        disableHoverableContent={isTouch ? true : disableHoverableContent}
        {...props}
      >
        {children}
      </TooltipPrimitive.Root>
    </TooltipContext.Provider>
  );
};

const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ onClick, ...props }, ref) => {
  const ctx = React.useContext(TooltipContext);
  const isTouch = ctx?.isTouch ?? false;
  const open = ctx?.open ?? false;
  const setOpen = ctx?.setOpen ?? (() => {});

  return (
    <TooltipPrimitive.Trigger
      ref={ref}
      onClick={(e) => {
        onClick?.(e);
        if (isTouch) {
          e.preventDefault();
          setOpen(!open);
        }
      }}
      {...props}
    />
  );
});
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 outline-none",
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
