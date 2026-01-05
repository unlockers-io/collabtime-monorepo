import { z } from "zod";

/**
 * Allowed origins for redirect URLs to prevent open redirect attacks.
 * These must be kept in sync with trustedOrigins in the auth config.
 */
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://collabtime.io",
  "https://www.collabtime.io",
] as const;

/**
 * Validate that a URL is safe to redirect to.
 * Only allows URLs from our allowed origins to prevent open redirect attacks.
 *
 * @param url - The URL to validate
 * @returns true if the URL is from an allowed origin, false otherwise
 */
const isValidRedirectUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);

    return ALLOWED_ORIGINS.some(
      (origin) =>
        parsed.origin === origin || parsed.origin === new URL(origin).origin
    );
  } catch {
    return false;
  }
};

/**
 * Pre-built Zod schema for validated redirect URLs.
 */
const redirectUrlSchema = z
  .string()
  .url()
  .refine(isValidRedirectUrl, { message: "Invalid redirect URL" });

export { ALLOWED_ORIGINS, isValidRedirectUrl, redirectUrlSchema };
