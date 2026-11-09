import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-server";
import { type RedirectParam, safeRedirectPath } from "@/lib/redirect-validation";

export const AuthGate = async ({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: RedirectParam }>;
}) => {
  const session = await getSession();

  if (session) {
    const params = await searchParams;
    redirect(safeRedirectPath(params?.redirect));
  }

  return null;
};
