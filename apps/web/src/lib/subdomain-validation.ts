import { z } from "zod";

/**
 * List of reserved subdomains that cannot be claimed by users.
 * These are commonly used for system purposes or are brand-sensitive.
 */
const RESERVED_SUBDOMAINS = new Set([
  // System/Infrastructure
  "api",
  "app",
  "www",
  "admin",
  "dashboard",
  "console",
  "portal",
  "cdn",
  "assets",
  "static",
  "media",
  "images",
  "files",

  // Email/Communication
  "mail",
  "email",
  "smtp",
  "imap",
  "pop",
  "webmail",

  // Authentication
  "auth",
  "login",
  "signin",
  "signup",
  "register",
  "account",
  "accounts",
  "oauth",
  "sso",

  // Support/Help
  "help",
  "support",
  "docs",
  "documentation",
  "wiki",
  "faq",
  "kb",
  "knowledge",

  // Status/Monitoring
  "status",
  "health",
  "monitor",
  "metrics",
  "stats",
  "analytics",

  // Development
  "dev",
  "development",
  "staging",
  "test",
  "testing",
  "sandbox",
  "demo",
  "preview",
  "beta",
  "alpha",

  // Marketing/Public
  "blog",
  "news",
  "press",
  "careers",
  "jobs",
  "about",
  "contact",
  "legal",
  "privacy",
  "terms",
  "tos",

  // Technical
  "git",
  "svn",
  "ftp",
  "sftp",
  "ssh",
  "ns1",
  "ns2",
  "dns",
  "mx",

  // Common brand protection
  "collabtime",
  "collab-time",
  "official",
  "team",
  "teams",
  "workspace",
  "workspaces",
  "space",
  "spaces",

  // Offensive/problematic
  "root",
  "superuser",
  "moderator",
  "mod",
  "null",
  "undefined",
  "void",
  "system",
]);

/**
 * Check if a subdomain is reserved.
 */
const isReservedSubdomain = (subdomain: string): boolean => {
  return RESERVED_SUBDOMAINS.has(subdomain.toLowerCase());
};

/**
 * Subdomain validation regex.
 * - Must be 3-63 characters
 * - Must start and end with alphanumeric
 * - Can contain hyphens in the middle
 * - Must be lowercase
 */
const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;

/**
 * Validate subdomain format.
 */
const isValidSubdomainFormat = (subdomain: string): boolean => {
  if (subdomain.length < 3 || subdomain.length > 63) {
    return false;
  }
  return SUBDOMAIN_REGEX.test(subdomain);
};

/**
 * Full subdomain validation.
 */
const validateSubdomain = (
  subdomain: string
): { valid: true } | { valid: false; error: string } => {
  // Check length
  if (subdomain.length < 3) {
    return { valid: false, error: "Subdomain must be at least 3 characters" };
  }

  if (subdomain.length > 63) {
    return { valid: false, error: "Subdomain must be at most 63 characters" };
  }

  // Check format
  if (!isValidSubdomainFormat(subdomain)) {
    return {
      valid: false,
      error:
        "Subdomain must be lowercase, start and end with alphanumeric characters, and can only contain hyphens in the middle",
    };
  }

  // Check reserved
  if (isReservedSubdomain(subdomain)) {
    return { valid: false, error: "This subdomain is reserved" };
  }

  return { valid: true };
};

/**
 * Zod schema for subdomain validation.
 */
const subdomainSchema = z
  .string()
  .min(3, "Subdomain must be at least 3 characters")
  .max(63, "Subdomain must be at most 63 characters")
  .regex(SUBDOMAIN_REGEX, {
    message:
      "Subdomain must be lowercase, start and end with alphanumeric characters, and can only contain hyphens",
  })
  .refine((val) => !isReservedSubdomain(val), {
    message: "This subdomain is reserved",
  });

export {
  RESERVED_SUBDOMAINS,
  isReservedSubdomain,
  isValidSubdomainFormat,
  validateSubdomain,
  subdomainSchema,
};
