"use client";

import { buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { LogIn } from "lucide-react";
import Link from "next/link";

import { useSignOut } from "@/hooks/use-sign-out";
import { APP_REPO_URL } from "@/lib/constants";

import { GithubIcon } from "./github-icon";
import { ModeToggle } from "./mode-toggle";
import { Logo } from "./nav/logo";
import { UserMenu } from "./nav/user-menu";

type NavProps = { isAuthenticated: boolean };

type NavViewProps = NavProps & { signOut: ReturnType<typeof useSignOut> };

const NavView = ({ isAuthenticated, signOut }: NavViewProps) => (
  <header className="mx-auto flex w-full max-w-450 items-center justify-between px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
    <Logo />
    <div className="flex items-center gap-2">
      {!isAuthenticated && (
        <a
          aria-label="View on GitHub"
          className={cn(buttonVariants({ size: "icon", variant: "ghost" }))}
          href={APP_REPO_URL}
          rel="noreferrer"
          target="_blank"
        >
          <GithubIcon />
        </a>
      )}
      <ModeToggle />
      {isAuthenticated ? (
        <UserMenu
          isSigningOut={signOut.isSigningOut}
          navRole="account"
          onSignOut={() => {
            void signOut.handleSignOut();
          }}
        />
      ) : (
        <Link
          aria-label="Sign in"
          className={cn(buttonVariants({ variant: "outline" }))}
          href="/login"
        >
          <LogIn aria-hidden className="size-4 sm:hidden" />
          <span className="max-sm:hidden">Sign in</span>
        </Link>
      )}
    </div>
  </header>
);

const Nav = (props: NavProps) => {
  const signOut = useSignOut();

  return <NavView {...props} signOut={signOut} />;
};

export { Nav, NavView };
