"use client";
import { Button } from "@repo/ui/components/button";

import { useSignOut } from "@/hooks/use-sign-out";

type Props = { invitedEmailMasked: string; returnTo: string };
export const InviteMismatchNoticeView = ({
  invitedEmailMasked,
  onSwitchAccount,
  pending,
}: {
  invitedEmailMasked: string;
  onSwitchAccount: () => void;
  pending: boolean;
}) => (
  <div className="flex flex-col gap-3">
    <p className="text-sm text-muted-foreground">
      This invitation was sent to {invitedEmailMasked}. Sign in with that address, or request to
      join with your current account.
    </p>
    <Button
      className="self-start"
      disabled={pending}
      onClick={onSwitchAccount}
      size="sm"
      variant="outline"
    >
      {pending ? "Signing out…" : "Switch account"}
    </Button>
  </div>
);
export const InviteMismatchNotice = ({ invitedEmailMasked, returnTo }: Props) => {
  const { handleSignOut, isSigningOut } = useSignOut({
    redirectTo: `/login?redirect=${encodeURIComponent(returnTo)}`,
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
