export const displayName = (name: string | null, email: string): string => {
  const trimmed = name?.trim();
  if (trimmed !== undefined && trimmed !== "") {
    return trimmed;
  }
  const [localPart = ""] = email.split("@");
  return localPart === "" ? "Someone" : localPart;
};
