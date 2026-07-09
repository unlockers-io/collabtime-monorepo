import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Nav } from "@/components/nav";
import { getSession } from "@/lib/auth-server";

// Session gate as a Suspense sibling so the static shell stays prerenderable under cacheComponents.
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
