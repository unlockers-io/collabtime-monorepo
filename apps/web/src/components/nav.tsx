"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button, buttonVariants } from "@repo/ui/components/button";
import { Archive, LogIn, Menu, Settings, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { CurrentTimeDisplay } from "./current-time-display";
import { ModeToggle } from "./mode-toggle";
import { CopyLinkButton } from "./nav/copy-link-button";
import { NavLogo } from "./nav/logo";
import { MobileMenu } from "./nav/mobile-menu";
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

const Nav = (props: NavProps) => {
  const { isAuthenticated } = props;
  const [hasCopied, setHasCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const variant = props.variant || "default";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setHasCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  // Centered variant - simple logo only
  if (variant === "centered") {
    return (
      <header className="flex items-center justify-center px-4 py-8 sm:px-6">
        <NavLogo />
      </header>
    );
  }

  // Team variant - with team name and editing
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

    return (
      <header className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <NavLogo showTitle={false} />
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

          {/* Desktop actions */}
          <div className="hidden items-center gap-2 sm:flex">
            <CurrentTimeDisplay />
            <CopyLinkButton hasCopied={hasCopied} onCopy={handleCopyLink} />
            <ModeToggle />
            {canDeleteWorkspace && <WorkspaceMenu onDeleteWorkspace={handleDeleteWorkspace} />}
            <UserMenu isAdmin={isAdmin} isAuthenticated={isAuthenticated} />
          </div>

          {/* Mobile menu toggle */}
          <div className="flex items-center gap-2 sm:hidden">
            <Button
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              className="size-9"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              size="icon"
              variant="outline"
            >
              {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
          </div>
        </div>

        <MobileMenu
          canDeleteWorkspace={canDeleteWorkspace}
          hasCopied={hasCopied}
          isAdmin={isAdmin}
          isAuthenticated={isAuthenticated}
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          onCopy={handleCopyLink}
          onDeleteWorkspace={handleDeleteWorkspace}
        />
      </header>
    );
  }

  // Default variant - simple nav with logo and auth
  return (
    <header className="flex items-center justify-between px-4 py-6 sm:px-6">
      <NavLogo />
      <div className="flex items-center gap-2">
        <ModeToggle />
        {isAuthenticated ? (
          <Link className={buttonVariants({ variant: "outline" })} href="/settings">
            <Settings className="size-4" />
          </Link>
        ) : (
          <Link className={buttonVariants({ variant: "outline" })} href="/login">
            <LogIn className="size-4" />
          </Link>
        )}
      </div>
    </header>
  );
};

export { Nav };
