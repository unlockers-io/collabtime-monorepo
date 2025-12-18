"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Globe,
  LogOut,
  Menu,
  Pencil,
  Shield,
  User,
  X,
} from "lucide-react";
import { logout } from "@/lib/team-session";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";
import { CurrentTimeDisplay } from "@/components/current-time-display";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TeamNavbarProps = {
  teamId: string;
  teamName: string;
  isAdmin: boolean;
  isEditingName: boolean;
  token: string;
  onEditName: () => void;
  onNameChange: (name: string) => void;
  onSaveName: () => void;
  onCancelEdit: () => void;
  onLogout: () => void;
};

const TeamNavbar = ({
  teamId,
  teamName,
  isAdmin,
  isEditingName,
  token,
  onEditName,
  onNameChange,
  onSaveName,
  onCancelEdit,
  onLogout,
}: TeamNavbarProps) => {
  const router = useRouter();
  const [hasCopied, setHasCopied] = useState(false);
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSaveName();
    } else if (e.key === "Escape") {
      onCancelEdit();
    }
  };

  const handleLogout = () => {
    startLogoutTransition(async () => {
      await logout(teamId, token);
      onLogout();
      toast.success("Logged out successfully");
      router.refresh();
    });
  };

  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        {/* Left side: Logo + Team name */}
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 transition-opacity hover:opacity-80 dark:bg-neutral-100"
            aria-label="Go to homepage"
          >
            <Globe className="h-5 w-5 text-white dark:text-neutral-900" />
          </Link>
          {isAdmin ? (
            isEditingName ? (
              <input
                type="text"
                value={teamName}
                onChange={(e) => onNameChange(e.target.value)}
                onBlur={onSaveName}
                onKeyDown={handleKeyDown}
                autoFocus
                placeholder="Team name…"
                className="h-9 w-full max-w-48 rounded-lg border border-neutral-200 bg-white px-3 text-base font-bold tracking-tight text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-400 dark:focus:ring-neutral-400/20 sm:text-lg"
              />
            ) : (
              <button
                onClick={onEditName}
                className="group flex min-w-0 items-center gap-2"
              >
                <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                  {teamName || "Team Workspace"}
                </h1>
                <Pencil
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-neutral-400 transition-opacity",
                    teamName
                      ? "opacity-0 group-hover:opacity-100"
                      : "opacity-100"
                  )}
                />
              </button>
            )
          ) : (
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
              {teamName || "Team Workspace"}
            </h1>
          )}
        </div>

        {/* Right side: Actions - Desktop */}
        <div className="hidden items-center gap-2 sm:flex">
          <CurrentTimeDisplay />
          <button
            onClick={handleCopyLink}
            className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 shadow-sm transition-all hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:focus-visible:ring-neutral-100 dark:focus-visible:ring-offset-neutral-950 sm:px-4"
          >
            <AnimatePresence mode="wait">
              {hasCopied ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-green-700 dark:text-green-400"
                >
                  <Check className="h-4 w-4" />
                </motion.div>
              ) : (
                <motion.div
                  key="copy"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Copy className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>
            <span className="hidden lg:inline">{hasCopied ? "Copied!" : "Copy Link"}</span>
          </button>
          <ModeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                aria-label="Account menu"
              >
                {isAdmin ? (
                  <Shield className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5 text-sm">
                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                  {isAdmin ? "Admin" : "Member"}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {isAdmin ? "Full access" : "View only"}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="text-red-600 focus:bg-red-50 focus:text-red-600 dark:text-red-400 dark:focus:bg-red-950 dark:focus:text-red-400"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {isLoggingOut ? "Logging out…" : "Log out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right side: Actions - Mobile */}
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

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden sm:hidden"
          >
            <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
              {/* Role badge */}
              <div className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800">
                {isAdmin ? (
                  <Shield className="h-4 w-4 text-neutral-500" />
                ) : (
                  <User className="h-4 w-4 text-neutral-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {isAdmin ? "Admin" : "Member"}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {isAdmin ? "Full access" : "View only"}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    handleCopyLink();
                    setMobileMenuOpen(false);
                  }}
                >
                  {hasCopied ? (
                    <Check className="mr-2 h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {hasCopied ? "Copied!" : "Copy Link"}
                </Button>

                <div className="flex items-center justify-between rounded-lg px-4 py-2">
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">Theme</span>
                  <ModeToggle />
                </div>

                <Button
                  variant="ghost"
                  className="justify-start text-red-600 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-400"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {isLoggingOut ? "Logging out…" : "Log out"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Share this page with your team to collaborate across timezones
      </p>
    </header>
  );
};

export { TeamNavbar };
