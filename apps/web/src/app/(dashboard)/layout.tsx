import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Nav } from "@/components/nav";
import { getSession } from "@/lib/auth-server";

// Session gate rendered as a Suspense-wrapped sibling (it emits no UI) so the
// static nav shell stays prerenderable under cacheComponents; pages below do
// their own session-bound rendering.
const DashboardGate = async () => {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return null;
};

type DashboardLayoutProps = {
  children: React.ReactNode;
};

const DashboardLayout = ({ children }: DashboardLayoutProps) => (
  <div className="flex min-h-screen flex-col">
    <Suspense fallback={null}>
      <DashboardGate />
    </Suspense>
    <Nav isAuthenticated />
    <main className="flex-1" id="main">
      {children}
    </main>
  </div>
);

export default DashboardLayout;
