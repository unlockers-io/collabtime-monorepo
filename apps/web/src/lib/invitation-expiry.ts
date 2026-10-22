const DAY_MS = 86_400_000;

export const formatExpiresIn = (expiresAt: string | null, now = new Date()): string | null => {
  if (expiresAt === null) {
    return null;
  }

  const remaining = new Date(expiresAt).getTime() - now.getTime();

  if (remaining <= 0) {
    return "Expired";
  }

  if (remaining < DAY_MS) {
    return "Expires today";
  }

  const days = Math.ceil(remaining / DAY_MS);

  return `Expires in ${days} ${days === 1 ? "day" : "days"}`;
};
