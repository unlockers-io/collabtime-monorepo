export const displayName = (name: string | null, email: string): string => {
  const trimmed = name?.trim();
  if (trimmed !== undefined && trimmed !== "") {
    return trimmed;
  }
  const localPart = email.split("@")[0];
  return localPart === "" ? "Someone" : localPart;
};
