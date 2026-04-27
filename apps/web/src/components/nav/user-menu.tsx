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
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type UserMenuProps = {
  isAdmin: boolean;
  isAuthenticated: boolean;
};

const UserMenu = ({ isAdmin, isAuthenticated }: UserMenuProps) => {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut({
        fetchOptions: {
          onError: (ctx) => {
            // oxlint-disable-next-line no-console -- surface sign-out errors from auth client
            console.error("Sign out error:", ctx.error);
            toast.error("Failed to sign out");
          },
          onSuccess: () => {
            toast.success("Signed out successfully");
            router.push("/");
            router.refresh();
          },
        },
      });
    } catch (error) {
      // oxlint-disable-next-line no-console -- surface unexpected sign-out errors
      console.error("Sign out error:", error);
      toast.error("Failed to sign out");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button aria-label="Account menu" size="icon" variant="outline" />}
      >
        {isAdmin ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-popover">
        <div className="px-2 py-1.5 text-sm">
          <p className="font-medium text-popover-foreground">{isAdmin ? "Admin" : "Member"}</p>
          <p className="text-xs text-muted-foreground">{isAdmin ? "Full access" : "View only"}</p>
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
              <LogIn className="h-4 w-4" />
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
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { UserMenu };
