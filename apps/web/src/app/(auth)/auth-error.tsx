import Link from "next/link";

import { FormNotice } from "./auth-shell";

type AuthErrorKind =
  | "account-exists"
  | "invalid-credentials"
  | "invalid-reset-link"
  | "rate-limited"
  | "unknown";

type BetterAuthError = {
  code?: string;
  status?: number;
};

const KIND_BY_CODE = {
  INVALID_EMAIL_OR_PASSWORD: "invalid-credentials",
  INVALID_PASSWORD: "invalid-credentials",
  INVALID_TOKEN: "invalid-reset-link",
  USER_ALREADY_EXISTS: "account-exists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "account-exists",
} as const satisfies Record<string, AuthErrorKind>;

const isKnownCode = (code: string): code is keyof typeof KIND_BY_CODE =>
  Object.hasOwn(KIND_BY_CODE, code);

const authErrorKind = ({ code, status }: BetterAuthError): AuthErrorKind => {
  if (status === 429) {
    return "rate-limited";
  }
  if (code !== undefined && isKnownCode(code)) {
    return KIND_BY_CODE[code];
  }
  return "unknown";
};

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

type AuthErrorNoticeProps = MessageSlots & {
  kind: AuthErrorKind;
};

const AuthErrorNotice = ({ kind, signInLink }: AuthErrorNoticeProps) => (
  <FormNotice tone="error">{MESSAGES[kind]({ signInLink })}</FormNotice>
);

export { AuthErrorNotice, authErrorKind };
export type { AuthErrorKind };
