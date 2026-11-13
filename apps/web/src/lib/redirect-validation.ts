const FALLBACK_PATH = "/";

const ANCHOR_ORIGIN = "https://anchor.invalid";

type RedirectParam = Array<string> | string | null | undefined;

const safeRedirectPath = (value: RedirectParam): string => {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return FALLBACK_PATH;
  }

  try {
    if (new URL(value, ANCHOR_ORIGIN).origin !== ANCHOR_ORIGIN) {
      return FALLBACK_PATH;
    }
  } catch {
    return FALLBACK_PATH;
  }

  return value;
};

const withRedirect = (path: string, returnTo: string): string =>
  returnTo === FALLBACK_PATH ? path : `${path}?redirect=${encodeURIComponent(returnTo)}`;

export { safeRedirectPath, withRedirect };

export type { RedirectParam };
