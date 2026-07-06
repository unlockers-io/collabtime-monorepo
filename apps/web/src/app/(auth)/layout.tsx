import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getSession } from "@/lib/auth-server";

// Bounce authenticated users away from login/signup/recover/reset-password.
// Mirrors acme's proxy.ts pattern; collabtime has no middleware so the gate
// lives in the route layout. Rendered as a Suspense-wrapped sibling (it emits
// no UI) so the static auth shell stays prerenderable under cacheComponents.
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
