import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

type AuthLayoutProps = {
  children: React.ReactNode;
};

const AuthLayout = async ({ children }: AuthLayoutProps) => {
  // Bounce authenticated users away from login/signup/recover/reset-password.
  // Mirrors acme's proxy.ts pattern; collabtime has no middleware so the gate
  // lives in the route layout.
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">{children}</div>
    </div>
  );
};

export default AuthLayout;
