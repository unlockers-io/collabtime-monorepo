import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-server";
import { safeRedirectPath } from "@/lib/redirect-validation";

export const AuthGate = async ({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string | Array<string> }>;
}) => {
  const session = await getSession();

  if (session) {
    const params = await searchParams;
    redirect(safeRedirectPath(typeof params?.redirect === "string" ? params.redirect : undefined));
  }

  return null;
};
