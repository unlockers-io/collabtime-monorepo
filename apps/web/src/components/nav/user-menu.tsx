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

import { useSignOut } from "@/hooks/use-sign-out";
import { cn } from "@/lib/utils";

type UserMenuProps = {
  isAdmin?: boolean;
  isAuthenticated: boolean;
};

const UserMenu = ({ isAdmin, isAuthenticated }: UserMenuProps) => {
  const { handleSignOut, isSigningOut } = useSignOut();
  const hasTeamRole = typeof isAdmin === "boolean";
  let menuTitle = "Account";

  if (hasTeamRole) {
    menuTitle = isAdmin ? "Admin" : "Member";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button aria-label="Account menu" size="icon" variant="outline" />}
      >
        {isAdmin ? <Shield className="size-4" /> : <User className="size-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-popover">
        <div className="px-2 py-1.5 text-sm">
          <p className="font-medium text-popover-foreground">{menuTitle}</p>
          {hasTeamRole && (
            <p className="text-xs text-muted-foreground">{isAdmin ? "Full access" : "View only"}</p>
          )}
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
              onClick={handleSignOut}
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
