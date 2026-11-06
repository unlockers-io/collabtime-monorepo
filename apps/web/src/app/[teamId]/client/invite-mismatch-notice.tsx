"use client";

import { Button } from "@repo/ui/components/button";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";

import { signOutLabel } from "@/components/nav/user-menu";
import { useSignOut } from "@/hooks/use-sign-out";
import { withRedirect } from "@/lib/redirect-validation";

type Props = { invitedEmailMasked: string; returnTo: string };

export const InviteMismatchNoticeView = ({
  invitedEmailMasked,
  onSwitchAccount,
  pending,
}: {
  invitedEmailMasked: string;
  onSwitchAccount: () => void;
  pending: boolean;
}) => {
  const ready = useClientReady();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        This invitation was sent to {invitedEmailMasked}. Sign in with that address, or request to
        join with your current account.
      </p>
      <Button
        className="self-start"
        disabled={!ready || pending}
        onClick={onSwitchAccount}
        size="sm"
        variant="outline"
      >
        {pending ? signOutLabel(true) : "Switch account"}
      </Button>
    </div>
  );
};

export const InviteMismatchNotice = ({ invitedEmailMasked, returnTo }: Props) => {
  const { handleSignOut, isSigningOut } = useSignOut({
    redirectTo: withRedirect("/login", returnTo),
  });

  return (
    <InviteMismatchNoticeView
      invitedEmailMasked={invitedEmailMasked}
      onSwitchAccount={() => {
        void handleSignOut();
      }}
      pending={isSigningOut}
    />
  );
};
