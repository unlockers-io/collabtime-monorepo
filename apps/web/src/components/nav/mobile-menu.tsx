"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import { Check, Copy, Lock, LogIn, LogOut, Settings, Shield, Trash2, User } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Link from "next/link";

import { CurrentTimeDisplay } from "@/components/current-time-display";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

import type { NavRole } from "./user-menu";

type MobileMenuRole = Exclude<NavRole, "account">;

type MobileMenuProps = {
  onClose: () => void;
  onCopy: () => void;
  onDeleteWorkspace: () => void;
  onEditVisibility?: () => void;
  onSignOut: () => void;
  permissions: { canDeleteWorkspace: boolean; canEditVisibility?: boolean };
  role: MobileMenuRole;
  state: { hasCopied: boolean; isOpen: boolean; isSigningOut: boolean };
};

const COLLAPSE_MOTION = {
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  initial: { height: 0, opacity: 0 },
  transition: { duration: 0.2 },
};

const FADE_MOTION = {
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  initial: { opacity: 0 },
  transition: { duration: 0 },
};

const RoleSummary = ({ role }: { role: MobileMenuRole }) => (
  <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
    {role === "admin" ? (
      <Shield className="size-4 text-muted-foreground" />
    ) : (
      <User className="size-4 text-muted-foreground" />
    )}
    <div>
      <p className="text-sm font-medium text-foreground">{role === "admin" ? "Admin" : "Member"}</p>
      <p className="text-xs text-muted-foreground">
        {role === "admin" ? "Full access" : "View only"}
      </p>
    </div>
  </div>
);

const AccountLinks = ({
  isSigningOut,
  onClose,
  onSignOut,
  role,
}: Pick<MobileMenuProps, "onClose" | "onSignOut" | "role"> & { isSigningOut: boolean }) => {
  const linkClassName = cn(
    buttonVariants({ variant: "ghost" }),
    "flex items-center justify-start gap-2",
  );

  if (role === "guest") {
    return (
      <Link className={linkClassName} href="/login">
        <LogIn className="size-4" />
        Sign in
      </Link>
    );
  }

  return (
    <>
      <Link className={linkClassName} href="/settings">
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
  );
};

const MobileMenu = ({
  onClose,
  onCopy,
  onDeleteWorkspace,
  onEditVisibility,
  onSignOut,
  permissions: { canDeleteWorkspace, canEditVisibility = false },
  role,
  state: { hasCopied, isOpen, isSigningOut },
}: MobileMenuProps) => {
  const menuMotion = useReducedMotion() === true ? FADE_MOTION : COLLAPSE_MOTION;

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          animate={menuMotion.animate}
          className="overflow-hidden sm:hidden"
          exit={menuMotion.exit}
          id="mobile-menu"
          initial={menuMotion.initial}
          transition={menuMotion.transition}
        >
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
            <RoleSummary role={role} />

            <CurrentTimeDisplay />
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

              <AccountLinks
                isSigningOut={isSigningOut}
                onClose={onClose}
                onSignOut={onSignOut}
                role={role}
              />

              {canEditVisibility && (
                <Button
                  className="justify-start"
                  onClick={() => {
                    onEditVisibility?.();
                    onClose();
                  }}
                  variant="ghost"
                >
                  <Lock aria-hidden className="size-4" />
                  Sharing &amp; privacy
                </Button>
              )}
              {canDeleteWorkspace && (
                <Button
                  className="justify-start"
                  onClick={() => {
                    onDeleteWorkspace();
                    onClose();
                  }}
                  variant="destructive"
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
