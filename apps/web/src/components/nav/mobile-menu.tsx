"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import { Check, Copy, LogIn, LogOut, Settings, Shield, Trash2, User } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Link from "next/link";

import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

type MobileMenuRole = "admin" | "guest" | "member";

type MobileMenuProps = {
  canDeleteWorkspace: boolean;
  hasCopied: boolean;
  isOpen: boolean;
  isSigningOut: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDeleteWorkspace: () => void;
  onSignOut: () => void;
  role: MobileMenuRole;
};

const MobileMenu = ({
  canDeleteWorkspace,
  hasCopied,
  isOpen,
  isSigningOut,
  onClose,
  onCopy,
  onDeleteWorkspace,
  onSignOut,
  role,
}: MobileMenuProps) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          animate={prefersReducedMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
          className="overflow-hidden sm:hidden"
          exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          id="mobile-menu"
          initial={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
        >
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
            {/* Role badge */}
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
              {role === "admin" ? (
                <Shield className="size-4 text-muted-foreground" />
              ) : (
                <User className="size-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  {role === "admin" ? "Admin" : "Member"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {role === "admin" ? "Full access" : "View only"}
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
                    <Check className="size-4 text-success" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {hasCopied ? "Copied!" : "Copy Link"}
                </span>
              </Button>

              <div className="flex items-center justify-between rounded-lg px-4 py-2">
                <span className="text-sm text-foreground">Theme</span>
                <ModeToggle />
              </div>

              {role === "guest" && (
                <Link
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "flex items-center justify-start gap-2",
                  )}
                  href="/login"
                >
                  <LogIn className="size-4" />
                  Sign in
                </Link>
              )}

              {role !== "guest" && (
                <>
                  <Link
                    className={cn(
                      buttonVariants({ variant: "ghost" }),
                      "flex items-center justify-start gap-2",
                    )}
                    href="/settings"
                  >
                    <Settings className="size-4" />
                    Settings
                  </Link>
                  <Button
                    className="justify-start"
                    disabled={isSigningOut}
                    onClick={() => {
                      onSignOut();
                      onClose();
                    }}
                    variant="ghost"
                  >
                    <span className="flex items-center gap-2">
                      <LogOut className="size-4" />
                      {isSigningOut ? "Signing out…" : "Sign out"}
                    </span>
                  </Button>
                </>
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
                    <Trash2 className="size-4" />
                    Delete workspace
                  </span>
                </Button>
              )}
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
};

export { MobileMenu };
export type { MobileMenuRole };
