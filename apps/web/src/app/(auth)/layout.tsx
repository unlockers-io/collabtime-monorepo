import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getSession } from "@/lib/auth-server";

// Auth gate as a Suspense sibling so the static shell stays prerenderable under cacheComponents.
const AuthGate = async () => {
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  return null;
};

type AuthLayoutProps = {
  children: React.ReactNode;
};

const AuthLayout = ({ children }: AuthLayoutProps) => (
  <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
    <Suspense fallback={null}>
      <AuthGate />
    </Suspense>
    <div className="flex w-full max-w-sm flex-col gap-6">{children}</div>
  </div>
);

export default AuthLayout;
