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

export { authErrorKind };
export type { AuthErrorKind };
