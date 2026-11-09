export const displayName = (name: string | null, email: string): string => {
  const trimmed = name?.trim();

  if (trimmed !== undefined && trimmed !== "") {
    return trimmed;
  }

  const [localPart = ""] = email.split("@");

  return localPart === "" ? "Someone" : localPart;
};

/** A workspace's name, or null when it has none worth showing. */
export const normalizeTeamName = (name: string | null | undefined): string | null => {
  const trimmed = name?.trim() ?? "";

  return trimmed === "" ? null : trimmed;
};

export const workspaceName = (name: string | null | undefined): string =>
  normalizeTeamName(name) ?? "Untitled workspace";

/** "p***@example.com": enough to recognise an address without revealing it. */
export const maskEmail = (email: string): string => {
  const [local = "", domain = ""] = email.split("@");

  return `${local.slice(0, 1)}***@${domain}`;
};
