"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Check,
  Copy,
  Globe,
  LogIn,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Settings,
  Shield,
  Trash2,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

import { CurrentTimeDisplay } from "./current-time-display";
import { ModeToggle } from "./mode-toggle";

// Logo component
const NavLogo = ({ showTitle = true }: { showTitle?: boolean }) => (
  <Link
    aria-label={!showTitle ? "Go to homepage" : undefined}
    className="flex items-center gap-3 text-foreground transition-opacity hover:opacity-80"
    href="/"
  >
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
      <Globe className="h-5 w-5 text-primary-foreground" />
    </div>
    {showTitle && <span className="text-xl font-bold tracking-tight">Collab Time</span>}
  </Link>
);

// Team title with optional editing
type TeamTitleProps = {
  isAdmin: boolean;
  isEditing: boolean;
  onCancel: () => void;
  onChange: (name: string) => void;
  onEdit: () => void;
  onSave: () => void;
  teamName: string;
};

const TeamTitle = ({
  isAdmin,
  isEditing,
  onCancel,
  onChange,
  onEdit,
  onSave,
  teamName,
}: TeamTitleProps) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  if (!isAdmin) {
    return (
      <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
        {teamName || "Team Workspace"}
      </h1>
    );
  }

  if (isEditing) {
    return (
      <input
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- inline-edit input is mounted on user gesture; focusing immediately matches expectation
        autoFocus
        className="h-9 w-full max-w-48 rounded-lg border border-input bg-background px-3 text-base font-bold tracking-tight text-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 focus:outline-none sm:text-lg"
        onBlur={onSave}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Team name…"
        type="text"
        value={teamName}
      />
    );
  }

  return (
    <button className="group flex min-w-0 items-center gap-2" onClick={onEdit} type="button">
      <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
        {teamName || "Team Workspace"}
      </h1>
      <Pencil
        className={cn(
          "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-opacity",
          teamName ? "opacity-0 group-hover:opacity-100" : "opacity-100",
        )}
      />
    </button>
  );
};

// Copy link button
const CopyLinkButton = ({
  hasCopied,
  onCopy,
  onMobileClose,
}: {
  hasCopied: boolean;
  onCopy: () => void;
  onMobileClose?: () => void;
}) => (
  <Button
    className="justify-start"
    onClick={() => {
      onCopy();
      onMobileClose?.();
    }}
    variant="outline"
  >
    <span className="flex items-center gap-2">
      {hasCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      {hasCopied ? "Copied!" : "Copy Link"}
    </span>
  </Button>
);

// User menu dropdown
const UserMenu = ({ isAdmin, isAuthenticated }: { isAdmin: boolean; isAuthenticated: boolean }) => {
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

// Workspace actions menu (owner-only, team variant)
const WorkspaceMenu = ({ onDeleteWorkspace }: { onDeleteWorkspace: () => void }) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={<Button aria-label="Workspace actions" size="icon" variant="outline" />}
    >
      <MoreHorizontal className="h-4 w-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48 bg-popover">
      <DropdownMenuItem onClick={onDeleteWorkspace} variant="destructive">
        <Trash2 />
        Delete workspace
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// Mobile menu
const MobileMenu = ({
  canDeleteWorkspace,
  hasCopied,
  isAdmin,
  isAuthenticated,
  isOpen,
  onClose,
  onCopy,
  onDeleteWorkspace,
}: {
  canDeleteWorkspace: boolean;
  hasCopied: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isOpen: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDeleteWorkspace: () => void;
}) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        animate={{ height: "auto", opacity: 1 }}
        className="overflow-hidden sm:hidden"
        exit={{ height: 0, opacity: 0 }}
        initial={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
          {/* Role badge */}
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
            {isAdmin ? (
              <Shield className="h-4 w-4 text-muted-foreground" />
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">{isAdmin ? "Admin" : "Member"}</p>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? "Full access" : "View only"}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Button
              className="justify-start"
              onClick={() => {
                onCopy();
                onClose();
              }}
              variant="ghost"
            >
              <span className="flex items-center gap-2">
                {hasCopied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {hasCopied ? "Copied!" : "Copy Link"}
              </span>
            </Button>

            <div className="flex items-center justify-between rounded-lg px-4 py-2">
              <span className="text-sm text-foreground">Theme</span>
              <ModeToggle />
            </div>

            {!isAuthenticated && (
              <Link
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "flex items-center justify-start gap-2",
                )}
                href="/login"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </Link>
            )}

            {isAuthenticated && (
              <Link
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "flex items-center justify-start gap-2",
                )}
                href="/settings"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            )}

            {canDeleteWorkspace && (
              <Button
                className="justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  onDeleteWorkspace();
                  onClose();
                }}
                variant="ghost"
              >
                <span className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete workspace
                </span>
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

// Main Nav component
type NavProps = { isAuthenticated: boolean } & (
  | { variant?: "default" | "centered" }
  | {
      canDeleteWorkspace?: boolean;
      isAdmin: boolean;
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
              className="h-10 w-10"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              size="icon"
              variant="outline"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
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
            <Settings className="h-4 w-4" />
          </Link>
        ) : (
          <Link className={buttonVariants({ variant: "outline" })} href="/login">
            <LogIn className="h-4 w-4" />
          </Link>
        )}
      </div>
    </header>
  );
};

export { Nav };
