"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { Archive, Globe, Lock, Menu, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CurrentTimeDisplay } from "@/components/current-time-display";
import { ModeToggle } from "@/components/mode-toggle";
import { Logo } from "@/components/nav/logo";
import { type NavRole, UserMenu } from "@/components/nav/user-menu";
import { useSignOut } from "@/hooks/use-sign-out";

import { CopyLinkButton } from "./nav/copy-link-button";
import { MobileMenu } from "./nav/mobile-menu";
import { TeamTitle } from "./nav/team-title";
import { type OwnerActions, WorkspaceMenu } from "./nav/workspace-menu";

type TeamNavProps = {
  isArchived: boolean;
  isPrivate: boolean;
  navRole: NavRole;
  owner: OwnerActions | null;
  teamId: string;
  teamName: string;
};

type TeamNavViewProps = TeamNavProps & { signOut: ReturnType<typeof useSignOut> };

const TeamNavView = (props: TeamNavViewProps) => {
  const { isArchived, isPrivate, navRole, owner, signOut, teamId, teamName } = props;
  const [hasCopied, setHasCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const ready = useClientReady();

  const handleCopyLink = async () => {
    try {
      // Invitation hints stay out of shared links; a counted-people view stays in.
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      await navigator.clipboard.writeText(url.toString());
      setHasCopied(true);
      toast.success("Link copied");
      setTimeout(() => {
        setHasCopied(false);
      }, 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleSignOut = () => {
    void signOut.handleSignOut();
  };

  return (
    <header className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Logo />

        <div className="hidden items-center gap-2 sm:flex">
          <CurrentTimeDisplay />
          <CopyLinkButton
            hasCopied={hasCopied}
            onCopy={() => {
              void handleCopyLink();
            }}
            variant="outline"
          />
          <ModeToggle />
          {owner && <WorkspaceMenu {...owner} />}
          <UserMenu
            isSigningOut={signOut.isSigningOut}
            navRole={navRole}
            onSignOut={handleSignOut}
          />
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <Button
            aria-controls="mobile-menu"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            disabled={!ready}
            onClick={() => {
              setMobileMenuOpen(!mobileMenuOpen);
            }}
            size="icon-lg"
            variant="outline"
          >
            {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <TeamTitle isAdmin={navRole === "admin"} teamId={teamId} teamName={teamName} />
        {isPrivate ? (
          <Badge variant="secondary">
            <Lock aria-hidden />
            Private
          </Badge>
        ) : (
          <Badge title="Anyone with the link can view" variant="outline">
            <Globe aria-hidden />
            Public
          </Badge>
        )}
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
        onSignOut={handleSignOut}
        owner={owner}
        role={navRole}
        state={{ hasCopied, isOpen: mobileMenuOpen, isSigningOut: signOut.isSigningOut }}
      />
    </header>
  );
};

const TeamNav = (props: TeamNavProps) => {
  const signOut = useSignOut();

  return <TeamNavView {...props} signOut={signOut} />;
};

export { TeamNav, TeamNavView };
