const DAY_MS = 86_400_000;

/** Legacy invitations without an expiry never expire. */
const isExpired = (expiresAt: Date | string | null, now: Date): boolean =>
  expiresAt !== null && new Date(expiresAt).getTime() <= now.getTime();

/** Pending and unexpired: the only state a recipient can still accept or decline. */
const isInvitationOpen = (
  invitation: { expiresAt: Date | string | null; status: string },
  now: Date,
): boolean => invitation.status === "PENDING" && !isExpired(invitation.expiresAt, now);

const formatExpiresIn = (expiresAt: string | null, now: Date | null): string | null => {
  if (expiresAt === null || now === null) {
    return null;
  }

  if (isExpired(expiresAt, now)) {
    return "Expired";
  }

  const remaining = new Date(expiresAt).getTime() - now.getTime();

  if (remaining < DAY_MS) {
    return "Expires today";
  }

  // Nearest whole day, so a clock a few seconds off the server's can't add one.
  const days = Math.round(remaining / DAY_MS);

  return `Expires in ${days} ${days === 1 ? "day" : "days"}`;
};

/** " · Expires in 3 days", or nothing when there is no expiry to show. */
const expirySuffix = (expiresAt: string | null, now: Date | null): string => {
  const label = formatExpiresIn(expiresAt, now);

  return label === null ? "" : ` · ${label}`;
};

export { expirySuffix, formatExpiresIn, isExpired, isInvitationOpen };
