// Open-redirect gate for auth `?redirect=` params; Better Auth trustedOrigins is only a backstop.

const FALLBACK_PATH = "/";

// Fixed base for URL resolution: anything that escapes it resolves to a different origin.
const ANCHOR_ORIGIN = "https://collabtime.invalid";

const safeRedirectPath = (value: string | null | undefined): string => {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
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

export { safeRedirectPath };
