"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { cn } from "@repo/ui/lib/utils";
import { LogIn, LogOut, Settings, Shield, User } from "lucide-react";
import Link from "next/link";

import { type NavRole, ROLE_LABELS, signOutLabel } from "./nav-role";

// Named navRole, not role: a literal `role="account"` on a component reads as an
// ARIA role to jsx-a11y.
type UserMenuProps = {
  isSigningOut: boolean;
  navRole: NavRole;
  onSignOut: () => void;
};

const UserMenu = ({ isSigningOut, navRole, onSignOut }: UserMenuProps) => {
  const { description, title } = ROLE_LABELS[navRole];
  const isAuthenticated = navRole !== "guest";
  const ready = useClientReady();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={!ready}
        render={<Button aria-label="Account menu" size="icon" variant="outline" />}
      >
        {navRole === "admin" ? <Shield className="size-4" /> : <User className="size-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-sm">
          <p className="font-medium text-popover-foreground">{title}</p>
          {description !== null && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {!isAuthenticated && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <Link
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "flex cursor-pointer items-center gap-2",
                  )}
                  href="/login"
                />
              }
            >
              <LogIn className="size-4" />
              Sign in
            </DropdownMenuItem>
          </>
        )}
        {isAuthenticated && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={<Link className="flex items-center gap-2" href="/settings" />}
            >
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2"
              disabled={isSigningOut}
              onClick={onSignOut}
            >
              <LogOut className="size-4" />
              {signOutLabel(isSigningOut)}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { UserMenu };
