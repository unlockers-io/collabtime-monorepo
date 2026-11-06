"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { Lock, LogIn, LogOut, Settings, Shield, Trash2, User } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Link from "next/link";

import { CurrentTimeDisplay } from "@/components/current-time-display";
import { ModeToggle } from "@/components/mode-toggle";
import { type NavRole, ROLE_LABELS, signOutLabel } from "@/components/nav/user-menu";

import { CopyLinkButton } from "./copy-link-button";
import type { OwnerActions } from "./workspace-menu";

type MobileMenuProps = {
  onClose: () => void;
  onCopy: () => void;
  onSignOut: () => void;
  owner: OwnerActions | null;
  role: NavRole;
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

const RoleSummary = ({ role }: { role: NavRole }) => (
  <p className="flex items-center gap-2 px-2.5 text-xs text-muted-foreground">
    {role === "admin" ? <Shield className="size-3.5" /> : <User className="size-3.5" />}
    {[ROLE_LABELS[role].title, ROLE_LABELS[role].description].filter(Boolean).join(" · ")}
  </p>
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
          {signOutLabel(isSigningOut)}
        </span>
      </Button>
    </>
  );
};

const MobileMenu = ({
  onClose,
  onCopy,
  onSignOut,
  owner,
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
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <RoleSummary role={role} />

            <div className="flex flex-col gap-1">
              <CopyLinkButton
                hasCopied={hasCopied}
                onCopy={() => {
                  onCopy();
                  onClose();
                }}
                variant="ghost"
              />
              {owner && (
                <>
                  <Button
                    className="justify-start"
                    onClick={() => {
                      owner.onEditVisibility();
                      onClose();
                    }}
                    variant="ghost"
                  >
                    <Lock aria-hidden className="size-4" />
                    Sharing &amp; privacy
                  </Button>
                  <Button
                    className="justify-start"
                    onClick={() => {
                      owner.onDeleteWorkspace();
                      onClose();
                    }}
                    variant="ghost"
                  >
                    <span className="flex items-center gap-2">
                      <Trash2 className="size-4" />
                      Delete workspace…
                    </span>
                  </Button>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <div className="flex items-center justify-between px-2.5">
                <CurrentTimeDisplay />
                <ModeToggle />
              </div>
            </div>

            <div className="flex flex-col gap-1 border-t border-border pt-3">
              <AccountLinks
                isSigningOut={isSigningOut}
                onClose={onClose}
                onSignOut={onSignOut}
                role={role}
              />
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
};

export { MobileMenu };
