"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button, buttonVariants } from "@repo/ui/components/button";
import { toast } from "@repo/ui/components/sonner";
import { Archive, LogIn, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useSignOut } from "@/hooks/use-sign-out";

import { CurrentTimeDisplay } from "./current-time-display";
import { ModeToggle } from "./mode-toggle";
import { CopyLinkButton } from "./nav/copy-link-button";
import { Logo } from "./nav/logo";
import { MobileMenu } from "./nav/mobile-menu";
import type { MobileMenuRole } from "./nav/mobile-menu";
import { TeamTitle } from "./nav/team-title";
import { UserMenu } from "./nav/user-menu";
import { WorkspaceMenu } from "./nav/workspace-menu";

type NavProps = { isAuthenticated: boolean } & (
  | { variant?: "default" | "centered" }
  | {
      canDeleteWorkspace?: boolean;
      isAdmin: boolean;
      isArchived?: boolean;
      isEditingName: boolean;
      onCancelEdit: () => void;
      onDeleteWorkspace?: () => void;
      onEditName: () => void;
      onNameChange: (name: string) => void;
      onSaveName: () => void;
      teamName: string;
      variant: "team";
    }
);

type NavViewProps = NavProps & {
  signOut: ReturnType<typeof useSignOut>;
};

const NavView = (props: NavViewProps) => {
  const { isAuthenticated } = props;
  const [hasCopied, setHasCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { handleSignOut, isSigningOut } = props.signOut;

  const variant = props.variant ?? "default";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setHasCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => {
        setHasCopied(false);
      }, 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  if (variant === "centered") {
    return (
      <header className="flex items-center justify-center px-4 py-8 sm:px-6">
        <Logo />
      </header>
    );
  }

  if (variant === "team") {
    if (props.variant !== "team") {
      return null;
    }
    const {
      canDeleteWorkspace = false,
      isAdmin,
      isArchived = false,
      isEditingName,
      onCancelEdit,
      onDeleteWorkspace,
      onEditName,
      onNameChange,
      onSaveName,
      teamName,
    } = props;

    const handleDeleteWorkspace = () => {
      onDeleteWorkspace?.();
    };

    const signedInRole: MobileMenuRole = isAuthenticated ? "member" : "guest";
    const navRole: MobileMenuRole = isAdmin ? "admin" : signedInRole;

    return (
      <header className="flex flex-col gap-6 border-b border-border pb-8">
        <div className="flex items-center justify-between gap-3">
          <Logo />

          <div className="hidden items-center gap-2 sm:flex">
            <CurrentTimeDisplay />
            <CopyLinkButton
              hasCopied={hasCopied}
              onCopy={() => {
                void handleCopyLink();
              }}
            />
            <ModeToggle />
            {canDeleteWorkspace && <WorkspaceMenu onDeleteWorkspace={handleDeleteWorkspace} />}
            <UserMenu
              isSigningOut={isSigningOut}
              navRole={navRole}
              onSignOut={() => {
                void handleSignOut();
              }}
            />
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <Button
              aria-controls="mobile-menu"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              className="size-9"
              onClick={() => {
                setMobileMenuOpen(!mobileMenuOpen);
              }}
              size="icon"
              variant="outline"
            >
              {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <TeamTitle
            isAdmin={isAdmin}
            isEditing={isEditingName}
            onCancel={onCancelEdit}
            onChange={onNameChange}
            onEdit={onEditName}
            onSave={onSaveName}
            teamName={teamName}
          />
          {isArchived && (
            <Badge variant="secondary">
              <Archive />
              Archived
            </Badge>
          )}
        </div>

        <MobileMenu
          onClose={() => {
            setMobileMenuOpen(false);
          }}
          onCopy={() => {
            void handleCopyLink();
          }}
          onDeleteWorkspace={handleDeleteWorkspace}
          onSignOut={() => {
            void handleSignOut();
          }}
          permissions={{ canDeleteWorkspace }}
          role={navRole}
          state={{ hasCopied, isOpen: mobileMenuOpen, isSigningOut }}
        />
      </header>
    );
  }

  return (
    <header className="mx-auto flex w-full max-w-450 items-center justify-between px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
      <Logo />
      <div className="flex items-center gap-2">
        <ModeToggle />
        {isAuthenticated ? (
          <UserMenu
            isSigningOut={isSigningOut}
            navRole="account"
            onSignOut={() => {
              void handleSignOut();
            }}
          />
        ) : (
          <Link
            aria-label="Sign in"
            className={buttonVariants({ size: "icon", variant: "outline" })}
            href="/login"
          >
            <LogIn aria-hidden className="size-4" />
          </Link>
        )}
      </div>
    </header>
  );
};

const Nav = (props: NavProps) => {
  const signOut = useSignOut();
  return <NavView {...props} signOut={signOut} />;
};

export { Nav, NavView };
