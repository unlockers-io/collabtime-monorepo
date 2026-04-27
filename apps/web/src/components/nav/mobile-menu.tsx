"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import { Check, Copy, LogIn, Settings, Shield, Trash2, User } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";

import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

type MobileMenuProps = {
  canDeleteWorkspace: boolean;
  hasCopied: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isOpen: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDeleteWorkspace: () => void;
};

const MobileMenu = ({
  canDeleteWorkspace,
  hasCopied,
  isAdmin,
  isAuthenticated,
  isOpen,
  onClose,
  onCopy,
  onDeleteWorkspace,
}: MobileMenuProps) => (
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

export { MobileMenu };
