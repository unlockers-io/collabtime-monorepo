"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Globe,
  LogIn,
  Menu,
  Pencil,
  Settings,
  Shield,
  User,
  X,
} from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ModeToggle } from "./mode-toggle";
import { CurrentTimeDisplay } from "./current-time-display";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";

// Logo component
const NavLogo = ({ showTitle = true }: { showTitle?: boolean }) => (
  <Link
    href="/"
    className="flex items-center gap-3 text-foreground transition-opacity hover:opacity-80"
    aria-label={!showTitle ? "Go to homepage" : undefined}
  >
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
      <Globe className="h-5 w-5 text-primary-foreground" />
    </div>
    {showTitle && (
      <span className="text-xl font-bold tracking-tight">Collab Time</span>
    )}
  </Link>
);

// Team title with optional editing
type TeamTitleProps = {
  teamName: string;
  isAdmin: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onChange: (name: string) => void;
  onSave: () => void;
  onCancel: () => void;
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
      <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
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
        className="h-9 w-full max-w-48 rounded-lg border border-input bg-background px-3 text-base font-bold tracking-tight text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 sm:text-lg"
      />
    );
  }

  return (
    <button onClick={onEdit} className="group flex min-w-0 items-center gap-2">
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
    variant="outline"
    className="justify-start"
    onClick={() => {
      onCopy();
      onMobileClose?.();
    }}
  >
    <span className="flex items-center gap-2">
      {hasCopied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {hasCopied ? "Copied!" : "Copy Link"}
    </span>
  </Button>
);

// User menu dropdown
const UserMenu = ({
  isAdmin,
  isAuthenticated,
}: {
  isAdmin: boolean;
  isAuthenticated: boolean;
}) => {
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
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Account menu">
          {isAdmin ? (
            <Shield className="h-4 w-4" />
          ) : (
            <User className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-popover">
        <div className="px-2 py-1.5 text-sm">
          <p className="font-medium text-popover-foreground">
            {isAdmin ? "Admin" : "Member"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isAdmin ? "Full access" : "View only"}
          </p>
        </div>
        {!isAuthenticated && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Button variant="outline" asChild>
                <Link
                  href="/login"
                  className="flex cursor-pointer items-center gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in
                </Link>
              </Button>
            </DropdownMenuItem>
          </>
        )}
        {isAuthenticated && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href="/settings"
                className="flex cursor-pointer items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
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
  isOpen: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  hasCopied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden sm:hidden"
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
              <p className="text-sm font-medium text-foreground">
                {isAdmin ? "Admin" : "Member"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? "Full access" : "View only"}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => {
                onCopy();
                onClose();
              }}
            >
              <span className="flex items-center gap-2">
                {hasCopied ? (
                  <Check className="h-4 w-4 text-green-600" />
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
              <Button variant="ghost" className="justify-start" asChild>
                <Link href="/login" className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign in
                </Link>
              </Button>
            )}

            {isAuthenticated && (
              <Button variant="ghost" className="justify-start" asChild>
                <Link href="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

// Main Nav component
type NavProps =
  | { variant?: "default" | "centered" }
  | {
      variant: "team";
      teamName: string;
      isAdmin: boolean;
      isEditingName: boolean;
      onEditName: () => void;
      onNameChange: (name: string) => void;
      onSaveName: () => void;
      onCancelEdit: () => void;
    };

const Nav = (props: NavProps) => {
  const { data: session } = useSession();
  const [hasCopied, setHasCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthenticated = Boolean(session?.user);
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
      <header className="flex items-center justify-center py-8">
        <NavLogo />
      </header>
    );
  }

  // Team variant - with team name and editing
  if (variant === "team") {
    const {
      teamName,
      isAdmin,
      isEditingName,
      onEditName,
      onNameChange,
      onSaveName,
      onCancelEdit,
    } = props;

    return (
      <header className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
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
          <div className="hidden items-center gap-2 sm:flex">
            <CurrentTimeDisplay />
            <CopyLinkButton hasCopied={hasCopied} onCopy={handleCopyLink} />
            <ModeToggle />
            <UserMenu isAdmin={isAdmin} isAuthenticated={isAuthenticated} />
          </div>

          {/* Mobile menu toggle */}
          <div className="flex items-center gap-2 sm:hidden">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
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
    <header className="flex items-center justify-between py-6">
      <NavLogo />
      <div className="flex items-center gap-2">
        <ModeToggle />
        {isAuthenticated ? (
          <Button variant="outline" asChild>
            <Link href="/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" asChild>
            <Link href="/login">
              <LogIn className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
};

export { Nav };
