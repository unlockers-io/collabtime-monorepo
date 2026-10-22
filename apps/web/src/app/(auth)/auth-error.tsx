import Link from "next/link";

import type { AuthErrorKind } from "./auth-error-kind";

const RecoverLink = ({ children }: { children: React.ReactNode }) => (
  <Link className="font-medium underline underline-offset-4" href="/recover">
    {children}
  </Link>
);

type MessageSlots = {
  // Register passes its redirect-preserving sign-in link.
  signInLink?: React.ReactNode;
};

const MESSAGES = {
  "account-exists": ({ signInLink }: MessageSlots) => (
    <>
      An account with this email already exists. {signInLink ?? "Sign in"} or{" "}
      <RecoverLink>reset your password</RecoverLink>.
    </>
  ),
  "invalid-credentials": () => (
    <>
      Email or password is incorrect. Try again or <RecoverLink>reset your password</RecoverLink>.
    </>
  ),
  "invalid-reset-link": () => (
    <>
      This reset link has expired or was already used. <RecoverLink>Request a new link</RecoverLink>
      .
    </>
  ),
  "rate-limited": () => "Too many attempts. Wait a minute, then try again.",
  unknown: () => "Something went wrong. Check your connection and try again.",
} satisfies Record<AuthErrorKind, (slots: MessageSlots) => React.ReactNode>;

const authErrorMessage = (kind: AuthErrorKind | null, slots: MessageSlots = {}) =>
  kind === null ? null : MESSAGES[kind](slots);

export { authErrorMessage };
