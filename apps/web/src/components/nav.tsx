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
  Pencil,
  Settings,
  Shield,
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
    href="/"
    className="gap-3 flex items-center text-foreground transition-opacity hover:opacity-80"
    aria-label={!showTitle ? "Go to homepage" : undefined}
  >
    <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary">
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
  teamName,
  isAdmin,
  isEditing,
  onEdit,
  onChange,
  onSave,
  onCancel,
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
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl truncate">
        {teamName || "Team Workspace"}
      </h1>
    );
  }

  if (isEditing) {
    return (
      <input
        type="text"
        value={teamName}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
        onKeyDown={handleKeyDown}
        autoFocus
        placeholder="Team name…"
        className="h-9 max-w-48 px-3 text-base font-bold tracking-tight sm:text-lg w-full rounded-lg border border-input bg-background text-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 focus:outline-none"
      />
    );
  }

  return (
    <button onClick={onEdit} className="group min-w-0 gap-2 flex items-center">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl truncate">
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
    variant="outline"
    className="justify-start"
    onClick={() => {
      onCopy();
      onMobileClose?.();
    }}
  >
    <span className="gap-2 flex items-center">
      {hasCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
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
          onSuccess: () => {
            toast.success("Signed out successfully");
            router.push("/");
            router.refresh();
          },
          onError: (ctx) => {
            console.error("Sign out error:", ctx.error);
            toast.error("Failed to sign out");
          },
        },
      });
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to sign out");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon" aria-label="Account menu" />}
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
                  href="/login"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "gap-2 flex cursor-pointer items-center",
                  )}
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
              render={<Link href="/settings" className="gap-2 flex items-center" />}
            >
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleSignOut}
              className="gap-2 flex cursor-pointer items-center"
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

// Mobile menu
const MobileMenu = ({
  isOpen,
  isAdmin,
  isAuthenticated,
  hasCopied,
  onCopy,
  onClose,
}: {
  hasCopied: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isOpen: boolean;
  onClose: () => void;
  onCopy: () => void;
}) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="sm:hidden overflow-hidden"
      >
        <div className="gap-2 p-3 flex flex-col rounded-xl border border-border bg-card">
          {/* Role badge */}
          <div className="gap-2 px-3 py-2 flex items-center rounded-lg bg-muted">
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

          <div className="gap-1 flex flex-col">
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => {
                onCopy();
                onClose();
              }}
            >
              <span className="gap-2 flex items-center">
                {hasCopied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {hasCopied ? "Copied!" : "Copy Link"}
              </span>
            </Button>

            <div className="px-4 py-2 flex items-center justify-between rounded-lg">
              <span className="text-sm text-foreground">Theme</span>
              <ModeToggle />
            </div>

            {!isAuthenticated && (
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "gap-2 flex items-center justify-start",
                )}
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </Link>
            )}

            {isAuthenticated && (
              <Link
                href="/settings"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "gap-2 flex items-center justify-start",
                )}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
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
      isAdmin: boolean;
      isEditingName: boolean;
      onCancelEdit: () => void;
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
      <header className="px-4 py-8 sm:px-6 flex items-center justify-center">
        <NavLogo />
      </header>
    );
  }

  // Team variant - with team name and editing
  if (variant === "team") {
    if (props.variant !== "team") {
      return null;
    }
    const { teamName, isAdmin, isEditingName, onEditName, onNameChange, onSaveName, onCancelEdit } =
      props;

    return (
      <header className="gap-4 flex flex-col">
        <div className="gap-3 flex items-start justify-between">
          <div className="min-w-0 gap-3 flex items-center">
            <NavLogo showTitle={false} />
            <TeamTitle
              teamName={teamName}
              isAdmin={isAdmin}
              isEditing={isEditingName}
              onEdit={onEditName}
              onChange={onNameChange}
              onSave={onSaveName}
              onCancel={onCancelEdit}
            />
          </div>

          {/* Desktop actions */}
          <div className="gap-2 sm:flex hidden items-center">
            <CurrentTimeDisplay />
            <CopyLinkButton hasCopied={hasCopied} onCopy={handleCopyLink} />
            <ModeToggle />
            <UserMenu isAdmin={isAdmin} isAuthenticated={isAuthenticated} />
          </div>

          {/* Mobile menu toggle */}
          <div className="gap-2 sm:hidden flex items-center">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <MobileMenu
          isOpen={mobileMenuOpen}
          isAdmin={isAdmin}
          isAuthenticated={isAuthenticated}
          hasCopied={hasCopied}
          onCopy={handleCopyLink}
          onClose={() => setMobileMenuOpen(false)}
        />
      </header>
    );
  }

  // Default variant - simple nav with logo and auth
  return (
    <header className="px-4 py-6 sm:px-6 flex items-center justify-between">
      <NavLogo />
      <div className="gap-2 flex items-center">
        <ModeToggle />
        {isAuthenticated ? (
          <Link href="/settings" className={buttonVariants({ variant: "outline" })}>
            <Settings className="h-4 w-4" />
          </Link>
        ) : (
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            <LogIn className="h-4 w-4" />
          </Link>
        )}
      </div>
    </header>
  );
};

export { Nav };
