"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { ChevronRightIcon, CheckIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="ui:isolate ui:z-50 ui:outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "ui:z-50 ui:max-h-(--available-height) ui:w-(--anchor-width) ui:min-w-32 ui:origin-(--transform-origin) ui:overflow-x-hidden ui:overflow-y-auto ui:rounded-lg ui:bg-popover ui:p-1 ui:text-popover-foreground ui:shadow-md ui:ring-1 ui:ring-foreground/10 ui:duration-100 ui:data-closed:animate-out ui:data-closed:overflow-hidden ui:data-closed:fade-out-0 ui:data-closed:zoom-out-95 ui:data-open:animate-in ui:data-open:fade-in-0 ui:data-open:zoom-in-95 ui:data-[side=bottom]:slide-in-from-top-2 ui:data-[side=inline-end]:slide-in-from-left-2 ui:data-[side=inline-start]:slide-in-from-right-2 ui:data-[side=left]:slide-in-from-right-2 ui:data-[side=right]:slide-in-from-left-2 ui:data-[side=top]:slide-in-from-bottom-2",
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "ui:px-1.5 ui:py-1 ui:text-xs ui:font-medium ui:text-muted-foreground ui:data-inset:pl-7",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "ui:group/dropdown-menu-item ui:relative ui:flex ui:cursor-default ui:items-center ui:gap-1.5 ui:rounded-md ui:px-1.5 ui:py-1 ui:text-sm ui:outline-hidden ui:select-none ui:focus:bg-accent ui:focus:text-accent-foreground ui:not-data-[variant=destructive]:focus:**:text-accent-foreground ui:data-disabled:pointer-events-none ui:data-disabled:opacity-50 ui:data-inset:pl-7 ui:data-[variant=destructive]:text-destructive ui:data-[variant=destructive]:focus:bg-destructive/10 ui:data-[variant=destructive]:focus:text-destructive ui:dark:data-[variant=destructive]:focus:bg-destructive/20 ui:[&_svg]:pointer-events-none ui:[&_svg]:shrink-0 ui:[&_svg:not([class*='size-'])]:size-4 ui:data-[variant=destructive]:*:[svg]:text-destructive",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "ui:flex ui:cursor-default ui:items-center ui:gap-1.5 ui:rounded-md ui:px-1.5 ui:py-1 ui:text-sm ui:outline-hidden ui:select-none ui:focus:bg-accent ui:focus:text-accent-foreground ui:not-data-[variant=destructive]:focus:**:text-accent-foreground ui:data-inset:pl-7 ui:data-open:bg-accent ui:data-open:text-accent-foreground ui:data-popup-open:bg-accent ui:data-popup-open:text-accent-foreground ui:[&_svg]:pointer-events-none ui:[&_svg]:shrink-0 ui:[&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ui:ml-auto" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "ui:w-auto ui:min-w-[96px] ui:rounded-lg ui:bg-popover ui:p-1 ui:text-popover-foreground ui:shadow-lg ui:ring-1 ui:ring-foreground/10 ui:duration-100 ui:data-closed:animate-out ui:data-closed:fade-out-0 ui:data-closed:zoom-out-95 ui:data-open:animate-in ui:data-open:fade-in-0 ui:data-open:zoom-in-95 ui:data-[side=bottom]:slide-in-from-top-2 ui:data-[side=left]:slide-in-from-right-2 ui:data-[side=right]:slide-in-from-left-2 ui:data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: MenuPrimitive.CheckboxItem.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "ui:relative ui:flex ui:cursor-default ui:items-center ui:gap-1.5 ui:rounded-md ui:py-1 ui:pr-8 ui:pl-1.5 ui:text-sm ui:outline-hidden ui:select-none ui:focus:bg-accent ui:focus:text-accent-foreground ui:focus:**:text-accent-foreground ui:data-disabled:pointer-events-none ui:data-disabled:opacity-50 ui:data-inset:pl-7 ui:[&_svg]:pointer-events-none ui:[&_svg]:shrink-0 ui:[&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span
        className="ui:pointer-events-none ui:absolute ui:right-2 ui:flex ui:items-center ui:justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: MenuPrimitive.RadioItem.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "ui:relative ui:flex ui:cursor-default ui:items-center ui:gap-1.5 ui:rounded-md ui:py-1 ui:pr-8 ui:pl-1.5 ui:text-sm ui:outline-hidden ui:select-none ui:focus:bg-accent ui:focus:text-accent-foreground ui:focus:**:text-accent-foreground ui:data-disabled:pointer-events-none ui:data-disabled:opacity-50 ui:data-inset:pl-7 ui:[&_svg]:pointer-events-none ui:[&_svg]:shrink-0 ui:[&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span
        className="ui:pointer-events-none ui:absolute ui:right-2 ui:flex ui:items-center ui:justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("ui:-mx-1 ui:my-1 ui:h-px ui:bg-border", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ui:ml-auto ui:text-xs ui:tracking-widest ui:text-muted-foreground ui:group-focus/dropdown-menu-item:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
