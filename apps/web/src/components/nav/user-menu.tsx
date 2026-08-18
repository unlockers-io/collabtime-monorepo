"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { LogIn, LogOut, Settings, Shield, User } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Shared by the desktop and mobile menus so the two cannot disagree. Replaces an
 * (isAdmin?, isAuthenticated) pair whose 6 combinations included a signed-out
 * admin. "account" is the no-team-context case.
 */
type NavRole = "account" | "admin" | "guest" | "member";

const ROLE_LABELS = {
  account: { description: null, title: "Account" },
  admin: { description: "Full access", title: "Admin" },
  guest: { description: "View only", title: "Member" },
  member: { description: "View only", title: "Member" },
} satisfies Record<NavRole, { description: string | null; title: string }>;

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button aria-label="Account menu" size="icon" variant="outline" />}
      >
        {navRole === "admin" ? <Shield className="size-4" /> : <User className="size-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-popover">
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
              {isSigningOut ? "Signing out..." : "Sign out"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { UserMenu };
export type { NavRole };
