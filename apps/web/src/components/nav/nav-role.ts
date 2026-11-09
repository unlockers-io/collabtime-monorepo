/**
 * Shared by the desktop and mobile menus so the two cannot disagree. Replaces an
 * (isAdmin?, isAuthenticated) pair whose 6 combinations included a signed-out
 * admin. "account" is the no-team-context case.
 */
type NavRole = "account" | "admin" | "guest" | "member";

const ROLE_LABELS = {
  account: { description: null, title: "Account" },
  admin: { description: "Full access", title: "Admin" },
  guest: { description: "View only", title: "Guest" },
  member: { description: "View only", title: "Member" },
} satisfies Record<NavRole, { description: string | null; title: string }>;

const signOutLabel = (isSigningOut: boolean): string =>
  isSigningOut ? "Signing out…" : "Sign out";

export { ROLE_LABELS, signOutLabel };

export type { NavRole };
